import { Inject, Injectable, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { isLiveAiProviders } from "../../config";
import { LLM_PORT } from "../../ports/tokens";
import type { LlmPort } from "../../ports/llm.port";
import type {
  CamposCapturados,
  ConversacionState,
  PasoGuion,
} from "../types";
import { explainFechaTentativa } from "./fecha-tentativa.parser";
import { extractScriptPasoWithLlm } from "./script-llm.extract";

export interface ScriptTurnResult {
  textoRespuesta: string;
  pasoGuion: PasoGuion;
  camposCapturados: CamposCapturados;
  avanzado: boolean;
  guionCompleto: boolean;
}

const SEDES_ACTIVAS = ["jardín 1", "jardin 1", "jardín1", "jardin1", "j1"];

const PREGUNTA_FECHA =
  "¿Qué fecha tentativa tienen? Necesito día, mes y año, por ejemplo 22 de diciembre de 2026 o 15/03/2027.";

const COPY_FECHA_SIN_ANIO =
  "Necesito día, mes y año. Por ejemplo: 22 de diciembre de 2026.";

const COPY_FECHA_NO_INTERPRETADA =
  "No alcancé a interpretar la fecha. Indica día, mes y año, por ejemplo 22 de diciembre de 2026 o 15/03/2027.";

const COPY_FECHA_PASADA =
  "Esa fecha ya pasó. Indica un día, mes y año vigentes, por ejemplo 22 de diciembre de 2026.";

const COPY_AFORO =
  "¿Cuántas personas aproximadamente asistirán? (número entero, por ejemplo 120 o 120 personas)";

@Injectable()
export class ScriptService {
  constructor(
    @Optional() @Inject(LLM_PORT) private readonly llm?: LlmPort,
    @Optional() private readonly config?: ConfigService,
  ) {}

  /** ¿El turno debe quedar en captura de guion (sin RAG ni tools precio)? */
  isCapturaPendiente(conv: ConversacionState): boolean {
    return conv.pasoGuion !== "faq_libre" && !this.isCompleto(conv.camposCapturados);
  }

  isCompleto(campos: CamposCapturados): boolean {
    return Boolean(
      campos.nombre &&
        campos.tipoEvento &&
        campos.fechaTentativa &&
        campos.aforo != null &&
        (campos.sedeId || campos.sedeNombre) &&
        campos.intencionCotizar === true,
    );
  }

  async handleTurn(
    conv: ConversacionState,
    texto: string,
  ): Promise<ScriptTurnResult> {
    const campos = { ...conv.camposCapturados };
    let paso = conv.pasoGuion;
    const trimmed = texto.trim();
    if (paso === "presupuesto") {
      paso = "intencion";
    }

    if (paso === "saludo") {
      const nombre = extractNombre(trimmed);
      if (nombre) {
        campos.nombre = nombre;
        const tipo = extractTipoEvento(trimmed);
        if (tipo) {
          campos.tipoEvento = tipo;
          return reply(
            `Gracias, ${nombre}. ${PREGUNTA_FECHA}`,
            "fecha",
            campos,
          );
        }
        return reply(
          `Gracias, ${nombre}. ¿Qué tipo de evento celebran? (boda, xv, corporativo u otro)`,
          "ocasion",
          campos,
        );
      }
      if (campos.nombre) {
        paso = "ocasion";
        return {
          textoRespuesta: `¡Hola ${campos.nombre}! Soy el asistente de Tres Cielos. ¿Qué tipo de evento celebran? (boda, xv, corporativo u otro)`,
          pasoGuion: paso,
          camposCapturados: campos,
          avanzado: true,
          guionCompleto: false,
        };
      }
      return {
        textoRespuesta:
          "¡Hola! Soy el asistente de Tres Cielos. ¿Me compartes tu nombre, por favor?",
        pasoGuion: "nombre",
        camposCapturados: campos,
        avanzado: true,
        guionCompleto: false,
      };
    }

    switch (paso) {
      case "nombre": {
        const nombre =
          extractNombre(trimmed) ??
          (await this.llmExtract(paso, trimmed, campos))?.nombre ??
          null;
        if (!nombre) {
          return reply(
            "Para continuar, ¿me indiques tu nombre?",
            paso,
            campos,
          );
        }
        campos.nombre = nombre;
        return reply(
          `Gracias, ${nombre}. ¿Qué tipo de evento celebran? (boda, xv, corporativo u otro)`,
          "ocasion",
          campos,
        );
      }
      case "ocasion": {
        const tipo =
          extractTipoEvento(trimmed) ??
          (await this.llmExtract(paso, trimmed, campos))?.tipoEvento ??
          null;
        if (!tipo) {
          return reply(
            "¿El evento es boda, xv, corporativo, social u otro?",
            paso,
            campos,
          );
        }
        campos.tipoEvento = tipo;
        return reply(
          `Perfecto. ${PREGUNTA_FECHA}`,
          "fecha",
          campos,
        );
      }
      case "fecha": {
        const parsed = explainFechaTentativa(trimmed, { paso: "fecha" });
        if (parsed.ok) {
          campos.fechaTentativa = parsed.fecha;
          return reply(COPY_AFORO, "aforo", campos);
        }
        if (parsed.motivo === "sin_anio") {
          return reply(COPY_FECHA_SIN_ANIO, paso, campos);
        }
        if (parsed.motivo === "pasada") {
          return reply(COPY_FECHA_PASADA, paso, campos);
        }
        const llmFecha =
          (await this.llmExtract(paso, trimmed, campos))?.fechaTentativa ??
          null;
        if (!llmFecha) {
          return reply(COPY_FECHA_NO_INTERPRETADA, paso, campos);
        }
        campos.fechaTentativa = llmFecha;
        return reply(COPY_AFORO, "aforo", campos);
      }
      case "aforo": {
        const parsed = parseAforo(trimmed);
        if (parsed.ok) {
          campos.aforo = parsed.aforo;
          return reply(
            "¿Qué sede les interesa? Por ahora atendemos Jardín 1.",
            "sede",
            campos,
          );
        }
        if (parsed.motivo === "unidad_invalida") {
          const frag = parsed.fragmento ?? trimmed;
          return reply(
            `No puedo procesar '${frag}'. Indica un número entero, por ejemplo 120 o 120 personas.`,
            paso,
            campos,
          );
        }
        if (parsed.motivo === "fuera_rango") {
          return reply(
            "El aforo debe ser un entero entre 1 y 5000.",
            paso,
            campos,
          );
        }
        const llmAforo =
          (await this.llmExtract(paso, trimmed, campos))?.aforo ?? null;
        if (llmAforo == null) {
          return reply(
            "Necesito el aforo como número entero (por ejemplo 120 o 120 personas).",
            paso,
            campos,
          );
        }
        campos.aforo = llmAforo;
        return reply(
          "¿Qué sede les interesa? Por ahora atendemos Jardín 1.",
          "sede",
          campos,
        );
      }
      case "sede": {
        const sedeLex = extractSede(trimmed);
        const sede =
          sedeLex ??
          ((await this.llmExtract(paso, trimmed, campos))?.sedeConfirmada
            ? "Jardín 1"
            : null);
        if (!sede) {
          return reply(
            "Por el momento la sede activa es Jardín 1. ¿Confirmas Jardín 1?",
            paso,
            campos,
          );
        }
        campos.sedeNombre = sede;
        campos.sedeId = "sede-jardin-1";
        return reply(
          "¿Desean cotizar o reservar con nosotros? (sí / no)",
          "intencion",
          campos,
        );
      }
      case "intencion": {
        const intent =
          extractSiNo(trimmed) ??
          (await this.llmExtract(paso, trimmed, campos))?.intencionCotizar ??
          null;
        if (intent == null) {
          return reply("¿Confirman que desean cotizar? Responde sí o no.", paso, campos);
        }
        campos.intencionCotizar = intent;
        if (!intent) {
          return reply(
            "Entendido. Si más adelante quieres cotizar, aquí estaré. ¿Tienes otra pregunta?",
            "faq_libre",
            campos,
            true,
          );
        }
        return reply(
          "¡Listo! Ya tengo lo esencial para calificarte. Puedes preguntarme por paquetes, precios o políticas del venue.",
          "faq_libre",
          campos,
          true,
        );
      }
      case "faq_libre":
      default:
        return reply(
          "¿En qué más te puedo ayudar? Puedo consultar paquetes/precios del catálogo o políticas del venue.",
          "faq_libre",
          campos,
          this.isCompleto(campos),
        );
    }
  }

  private async llmExtract(
    paso: PasoGuion,
    texto: string,
    campos: CamposCapturados,
  ) {
    if (!this.llm || !isLiveAiProviders(this.config)) return null;
    return extractScriptPasoWithLlm({
      llm: this.llm,
      texto,
      paso,
      campos,
    });
  }
}

function reply(
  textoRespuesta: string,
  pasoGuion: PasoGuion,
  camposCapturados: CamposCapturados,
  guionCompleto = false,
): ScriptTurnResult {
  return {
    textoRespuesta,
    pasoGuion,
    camposCapturados,
    avanzado: true,
    guionCompleto,
  };
}

function stripAccents(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function extractNombre(texto: string): string | null {
  const looksLikeEvent = Boolean(extractTipoEvento(texto));
  const hasNameCue = /me llamo|soy|mi nombre es/i.test(texto);
  if (looksLikeEvent && !hasNameCue) return null;

  let cleaned = texto.trim();
  for (let i = 0; i < 3; i += 1) {
    const next = cleaned.replace(
      /^(hola|ola|hey|buenas?|qu[eé] tal|que tal|k tal)[\s,!.]*/i,
      "",
    );
    if (next === cleaned) break;
    cleaned = next;
  }
  const soy = cleaned.match(/(?:me llamo|soy|mi nombre es)\s+(.+)$/i);
  if (soy) cleaned = soy[1];
  cleaned = cleaned.replace(/[.,!?]+$/g, "").trim().replace(/\s+/g, " ");
  if (cleaned.length < 2 || cleaned.length > 80) return null;
  if (/^\d+$/.test(cleaned)) return null;
  if (/^(hola|ola|hey|buenas|si|sí|no|ok)$/i.test(cleaned)) return null;
  return cleaned;
}

function extractTipoEvento(texto: string): string | null {
  const t = stripAccents(texto.toLowerCase());
  if (/boda|voda|casamiento|wedding/.test(t)) return "boda";
  if (/\bxv\b|quinceanera|quince anos|15 anos|quince/.test(t)) return "xv";
  if (/corporativ/.test(t)) return "corporativo";
  if (/social/.test(t)) return "social";
  if (/otro/.test(t)) return "otro";
  return null;
}

const AFORO_UNIDADES = /^(pax|personas|invitados|gente)$/i;

export type AforoParseMotivo = "sin_numero" | "unidad_invalida" | "fuera_rango";

export type AforoParseResult =
  | { ok: true; aforo: number }
  | { ok: false; motivo: AforoParseMotivo; fragmento?: string };

function parseAforo(texto: string): AforoParseResult {
  const m = texto.match(/(\d{1,4})(?:\s*([a-záéíóúüñ]+))?/i);
  if (!m) return { ok: false, motivo: "sin_numero" };
  const n = Number(m[1]);
  const unidad = m[2];
  const fragmento = m[0].replace(/\s+/g, " ").trim();
  if (unidad && !AFORO_UNIDADES.test(unidad)) {
    return { ok: false, motivo: "unidad_invalida", fragmento };
  }
  if (!Number.isInteger(n) || n < 1 || n > 5000) {
    return { ok: false, motivo: "fuera_rango", fragmento };
  }
  return { ok: true, aforo: n };
}

function extractSede(texto: string): string | null {
  const t = stripAccents(texto.toLowerCase());
  if (
    SEDES_ACTIVAS.some((s) =>
      t.includes(stripAccents(s)),
    ) ||
    /jardn/.test(t)
  ) {
    return "Jardín 1";
  }
  if (/^(si|sí|ok|va|dale|confirmo)\b/.test(t) || /confirm/.test(t)) {
    return "Jardín 1";
  }
  return null;
}

function extractSiNo(texto: string): boolean | null {
  const t = stripAccents(texto.toLowerCase()).trim();
  if (
    /^(si|sip|ok|va|dale|yes|sale)\b/.test(t) ||
    /\b(claro|obvio|por supuesto|quiero cotizar|confirmo)\b/.test(t)
  ) {
    return true;
  }
  if (/^(no|nel|nop)\b|ahora no|luego/.test(t)) return false;
  return null;
}
