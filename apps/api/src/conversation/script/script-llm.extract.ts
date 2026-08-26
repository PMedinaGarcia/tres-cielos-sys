import type { LlmPort } from "../../ports/llm.port";
import type {
  CamposCapturados,
  FechaTentativa,
  PasoGuion,
} from "../types";
import {
  explainFechaTentativa,
  parseFechaTentativa,
  todayPartsMexico,
  tieneAnioExplicito,
} from "./fecha-tentativa.parser";

const CONF_MIN = 0.7;

const TIPOS = new Set(["boda", "xv", "corporativo", "social", "otro"]);

export interface LlmPasoExtract {
  confianza: number;
  nombre?: string | null;
  tipoEvento?: string | null;
  fechaTentativa?: FechaTentativa | null;
  aforo?: number | null;
  sedeConfirmada?: boolean | null;
  intencionCotizar?: boolean | null;
}

function parseJsonObject(content: string): Record<string, unknown> | null {
  const trimmed = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end < 0) return null;
  try {
    return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function coerceFecha(
  raw: unknown,
  texto: string,
  now: Date,
): FechaTentativa | null {
  const lexical = explainFechaTentativa(texto, { now, paso: "fecha" });
  if (!lexical.ok && lexical.motivo === "sin_anio") {
    return null;
  }
  if (!lexical.ok && !tieneAnioExplicito(texto)) {
    return null;
  }
  if (!raw) {
    return parseFechaTentativa(texto, { now, paso: "fecha" });
  }
  if (typeof raw === "string") {
    return parseFechaTentativa(raw, { now, paso: "fecha" });
  }
  if (typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.fecha === "string") {
    return parseFechaTentativa(o.fecha, { now, paso: "fecha" });
  }
  if (typeof o.desde === "string" && typeof o.hasta === "string") {
    const a = parseFechaTentativa(o.desde, { now, paso: "fecha" });
    const b = parseFechaTentativa(o.hasta, { now, paso: "fecha" });
    if (a?.fecha && b?.fecha) {
      return {
        tipo: "rango",
        desde: a.fecha,
        hasta: b.fecha,
        flexible: Boolean(o.flexible),
      };
    }
  }
  if (typeof o.mes === "number" && typeof o.anio === "number") {
    return parseFechaTentativa(
      `${monthName(o.mes)} ${o.anio}`,
      { now, paso: "fecha" },
    );
  }
  return parseFechaTentativa(texto, { now, paso: "fecha" });
}

function monthName(mes: number): string {
  const names = [
    "",
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];
  return names[mes] ?? "";
}

export async function extractScriptPasoWithLlm(input: {
  llm: LlmPort;
  texto: string;
  paso: PasoGuion;
  campos: CamposCapturados;
  now?: Date;
}): Promise<LlmPasoExtract | null> {
  const now = input.now ?? new Date();
  const hoy = todayPartsMexico(now).iso;
  try {
    const result = await input.llm.complete({
      temperature: 0,
      maxTokens: 400,
      messages: [
        {
          role: "system",
          content: [
            "Extrae SOLO el campo del paso actual del guion de captura de Tres Cielos (venue de eventos, México).",
            "El usuario puede escribir mal, en jerga o con frases incompletas.",
            "No inventes datos que no estén anclados en el texto.",
            `Hoy (America/Mexico_City) es ${hoy}.`,
            "Responde JSON: {confianza:0-1, nombre?, tipoEvento?, fechaTentativa?, aforo?, sedeConfirmada?, intencionCotizar?}",
            "tipoEvento: boda|xv|corporativo|social|otro.",
            "fechaTentativa: {tipo:dia|rango|mes, fecha?:YYYY-MM-DD, desde?, hasta?, mes?, anio?, flexible?:boolean}.",
            "Si la fecha de calendario no trae año (20xx), no inventes el año.",
            "aforo: entero 1-5000; no extraigas si la unidad no es pax/personas/invitados/gente (p. ej. px no vale).",
            "sedeConfirmada: true si mencionan o confirman Tres Cielos Tequesquitengo (sede única).",
            "Si no puedes extraer con seguridad, confianza < 0.5 y omite el campo.",
          ].join(" "),
        },
        {
          role: "user",
          content: JSON.stringify({
            paso: input.paso,
            texto: input.texto,
            camposYaCapturados: input.campos,
          }),
        },
      ],
    });
    const obj = parseJsonObject(result.content);
    if (!obj) return null;
    const confianza =
      typeof obj.confianza === "number" ? obj.confianza : Number(obj.confianza);
    if (!Number.isFinite(confianza) || confianza < CONF_MIN) return null;

    const extracted: LlmPasoExtract = { confianza };
    if (typeof obj.nombre === "string" && obj.nombre.trim().length >= 2) {
      extracted.nombre = obj.nombre.trim().slice(0, 80);
    }
    if (typeof obj.tipoEvento === "string" && TIPOS.has(obj.tipoEvento)) {
      extracted.tipoEvento = obj.tipoEvento;
    }
    const fecha = coerceFecha(obj.fechaTentativa, input.texto, now);
    if (fecha) extracted.fechaTentativa = fecha;
    if (typeof obj.aforo === "number" && obj.aforo >= 1 && obj.aforo <= 5000) {
      extracted.aforo = Math.round(obj.aforo);
    }
    if (typeof obj.sedeConfirmada === "boolean") {
      extracted.sedeConfirmada = obj.sedeConfirmada;
    }
    if (typeof obj.intencionCotizar === "boolean") {
      extracted.intencionCotizar = obj.intencionCotizar;
    }
    return extracted;
  } catch {
    return null;
  }
}

export async function classifyIntentWithLlm(input: {
  llm: LlmPort;
  texto: string;
  pasoGuion: PasoGuion;
}): Promise<
  | "guion_captura"
  | "solicitud_humana"
  | "datos_duros"
  | "pregunta_documental"
  | "ambiguo"
  | null
> {
  try {
    const result = await input.llm.complete({
      temperature: 0,
      maxTokens: 120,
      messages: [
        {
          role: "system",
          content: [
            "Clasifica la intención del mensaje de un lead de un venue de eventos.",
            "El texto puede tener faltas de ortografía.",
            'JSON: {"intent":"guion_captura|solicitud_humana|datos_duros|pregunta_documental|ambiguo","confianza":0-1}',
            "datos_duros = precio, paquetes, cotización, qué tiene/incluye/trae el estándar o premium (aunque esté mal escrito: kuanto, pakete, preico, custa, estandar, que tiene).",
            "pregunta_documental = ubicación, cómo llegar, estacionamiento, venue. NO uses esta etiqueta para políticas de pago, horario de evento ni exclusiones de paquete.",
            "solicitud_humana = quiere hablar con una persona.",
            "Si hay riesgo de monto, prefiere datos_duros, nunca rag de precios.",
          ].join(" "),
        },
        {
          role: "user",
          content: JSON.stringify({
            texto: input.texto,
            pasoGuion: input.pasoGuion,
          }),
        },
      ],
    });
    const obj = parseJsonObject(result.content);
    if (!obj) return null;
    const confianza =
      typeof obj.confianza === "number" ? obj.confianza : Number(obj.confianza);
    if (Number.isFinite(confianza) && confianza < CONF_MIN) return null;
    const intent = String(obj.intent ?? "");
    const allowed = new Set([
      "guion_captura",
      "solicitud_humana",
      "datos_duros",
      "pregunta_documental",
      "ambiguo",
    ]);
    if (!allowed.has(intent)) return null;
    return intent as
      | "guion_captura"
      | "solicitud_humana"
      | "datos_duros"
      | "pregunta_documental"
      | "ambiguo";
  } catch {
    return null;
  }
}
