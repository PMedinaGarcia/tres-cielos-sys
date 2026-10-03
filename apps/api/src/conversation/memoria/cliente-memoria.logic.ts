import type {
  CamposCapturados,
  ConversacionState,
  PasoGuion,
} from "../types";

export const SESSION_GAP_MS = 12 * 60 * 60 * 1000;
export const VENTANA_MENSAJES = 8;

const PASO_LABEL: Record<string, string> = {
  saludo: "el saludo",
  nombre: "el nombre",
  nombre_fecha: "el nombre y la fecha",
  fecha: "la fecha",
  fecha_ventana: "la ventana de fecha",
  aforo: "el número de invitados",
  aforo_inversion: "invitados e inversión",
  aclaracion_piso: "el piso de inversión",
  accion: "la siguiente acción",
  presupuesto: "el presupuesto",
  presupuesto_fuera: "el rango de presupuesto",
  intencion: "la intención",
  faq_libre: "las preguntas abiertas",
};

/** Un valor vacío no borra un dato ya capturado. `boda` por defecto no pisa otro tipo de evento. */
export function mergeCampos(
  base: CamposCapturados,
  incoming: CamposCapturados,
): CamposCapturados {
  const next: CamposCapturados = { ...base };
  for (const key of Object.keys(incoming) as Array<keyof CamposCapturados>) {
    const value = incoming[key];
    if (value == null) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    if (
      key === "tipoEvento" &&
      value === "boda" &&
      base.tipoEvento &&
      base.tipoEvento !== "boda"
    ) {
      continue;
    }
    (next as Record<string, unknown>)[key] = value;
  }
  return next;
}

export function canonicalCamposJson(
  campos: CamposCapturados,
): Record<string, unknown> {
  return {
    telefono: campos.telefono ?? null,
    nombre: campos.nombre ?? null,
    fechaTentativa: campos.fechaTentativa ?? null,
    tipoEvento: campos.tipoEvento ?? null,
    aforo: campos.aforo ?? null,
    sedeId: campos.sedeId ?? null,
    sedeNombre: campos.sedeNombre ?? null,
    presupuestoOrientativo: campos.presupuestoOrientativo ?? null,
    intencionCotizar: campos.intencionCotizar ?? null,
    intencionVisita: campos.intencionVisita ?? null,
    encajeEconomico: campos.encajeEconomico ?? null,
    intencionNivel: campos.intencionNivel ?? null,
    rangoInversion: campos.rangoInversion ?? null,
    aceptaPiso250k: campos.aceptaPiso250k ?? null,
    fechaEstado: campos.fechaEstado ?? null,
    rutaComercial: campos.rutaComercial ?? null,
    consentimientoSeguimiento: campos.consentimientoSeguimiento ?? null,
    numeroAclaracionesPiso: campos.numeroAclaracionesPiso ?? null,
    numeroMensajesCaptura: campos.numeroMensajesCaptura ?? null,
    fechaTipo: campos.fechaTipo ?? null,
    ventanaVisita: campos.ventanaVisita ?? null,
    aforoBanda: campos.aforoBanda ?? null,
    origenZona: campos.origenZona ?? null,
    email: campos.email ?? null,
    pdfEnviado: campos.pdfEnviado ?? null,
    adjuntoReintentos: campos.adjuntoReintentos ?? null,
    ctaGuion: campos.ctaGuion ?? null,
    rangoPresupuestoFuera: campos.rangoPresupuestoFuera ?? null,
  };
}

export function buildResumen(input: {
  campos: CamposCapturados;
  pasoGuion: PasoGuion | string;
  ultimaRuta?: string | null;
  notasHandoff?: string[];
}): string {
  const c = input.campos;
  const partes: string[] = [];
  if (c.nombre) partes.push(`Contacto: ${c.nombre}.`);
  if (c.tipoEvento) partes.push(`Evento: ${c.tipoEvento}.`);
  if (c.fechaTentativa) {
    const f = c.fechaTentativa;
    const cuando = f.fecha ?? f.desde ?? (f.mes ? `mes ${f.mes}` : "tentativa");
    partes.push(`Fecha: ${cuando}.`);
  }
  if (c.aforo) partes.push(`Invitados: ${c.aforo}.`);
  if (c.rangoInversion) partes.push(`Inversión: ${c.rangoInversion}.`);
  if (c.rangoPresupuestoFuera) {
    partes.push(`Presupuesto fuera de piso: ${c.rangoPresupuestoFuera}.`);
  }
  if (c.ctaGuion) partes.push(`CTA: ${c.ctaGuion}.`);
  partes.push(`Paso: ${PASO_LABEL[input.pasoGuion] ?? input.pasoGuion}.`);
  if (input.ultimaRuta) partes.push(`Última ruta: ${input.ultimaRuta}.`);
  const notas = (input.notasHandoff ?? []).filter((n) => n.trim()).slice(-3);
  if (notas.length) {
    partes.push(`Con el asesor: ${notas.join(" | ")}.`);
  }
  return partes.join(" ").slice(0, 700);
}

export function resumeGreeting(input: {
  nombre?: string | null;
  pasoGuion: string;
  campos: CamposCapturados;
}): string {
  const nombre = input.nombre?.trim();
  const who = nombre ? `Hola de nuevo, ${nombre}.` : "Hola de nuevo.";
  const paso = PASO_LABEL[input.pasoGuion] ?? "el mismo punto";
  const datos: string[] = [];
  if (input.campos.fechaTentativa) datos.push("la fecha");
  if (input.campos.aforo) datos.push("los invitados");
  if (input.campos.rangoInversion || input.campos.rangoPresupuestoFuera) {
    datos.push("el presupuesto");
  }
  const extra = datos.length ? ` Ya tengo ${datos.join(", ")}.` : "";
  return `${who} Retomamos ${paso}.${extra}`;
}

export function debeReanudar(input: {
  ultimoTurnoEn: string | null;
  ahora: Date;
  gapMs?: number;
}): boolean {
  if (!input.ultimoTurnoEn) return false;
  const prev = Date.parse(input.ultimoTurnoEn);
  if (!Number.isFinite(prev)) return false;
  return input.ahora.getTime() - prev >= (input.gapMs ?? SESSION_GAP_MS);
}

export interface LineaMemoria {
  autor: "prospecto" | "bot" | "asesor";
  contenido: string;
}

export function formatMemoriaParaModelo(conv: {
  resumenMemoria?: string | null;
  ventanaContexto?: LineaMemoria[];
  mensajes?: Array<{ autor: string; contenido: string }>;
}): string {
  const lineas: string[] = [];
  if (conv.resumenMemoria?.trim()) {
    lineas.push(`Memoria del cliente: ${conv.resumenMemoria.trim()}`);
  }
  const ventana =
    conv.ventanaContexto?.length
      ? conv.ventanaContexto
      : (conv.mensajes ?? [])
          .slice(-VENTANA_MENSAJES)
          .map((m) => ({
            autor: (m.autor === "asesor" || m.autor === "bot" ? m.autor : "prospecto") as LineaMemoria["autor"],
            contenido: m.contenido,
          }));
  const recientes = ventana.slice(-VENTANA_MENSAJES).filter((m) => m.contenido?.trim());
  if (recientes.length) {
    lineas.push(
      "Mensajes recientes:",
      ...recientes.map((m) => `- ${m.autor}: ${m.contenido.trim().slice(0, 240)}`),
    );
  }
  return lineas.join("\n");
}

export function ultimasLineas(conv: ConversacionState): LineaMemoria[] {
  return (conv.mensajes ?? []).slice(-VENTANA_MENSAJES).map((m) => ({
    autor: m.autor,
    contenido: m.contenido,
  }));
}
