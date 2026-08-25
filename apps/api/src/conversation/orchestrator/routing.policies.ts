import type { IntentClasificado, PasoGuion } from "../types";

const HUMAN_RE =
  /\b(hablar con (un |una )?(humano|asesor|persona|agente)|quiero (un )?asesor|pasame (con|a) (un )?humano|atenci[oó]n humana)\b/i;

const QUEJA_RE =
  /\b(queja|demanda|estafa|fraude|abusiv|p[eé]simo servicio|voy a demandar)\b/i;

const CONFLICTO_RE =
  /\b(abogad[oa]|legal|demandar|procon|profeco)\b/i;

const DATOS_DUROS_RE =
  /\b(precio|precion|cuesta|custa|cu[aá]nto|kuanto|costo|cotiz|cotisar|paquete|pakete|sku|inclusi[oó]n|incluye|compar(a|ar) paquet|anticipo m[ií]nimo|tarifa)\b/i;

const DOCUMENTAL_RE =
  /\b(ubicaci[oó]n|c[oó]mo llegar|horario|pol[ií]tica|estacionamiento|dress code|faq|venue|jard[ií]n|descripci[oó]n)\b/i;

const MONTO_RIESGO_RE =
  /\b(\$\s*\d|\d+\s*(mxn|pesos)|cu[aá]nto|precio|tarifa|costo)\b/i;

export function detectForcedHandoff(texto: string): {
  handoff: boolean;
  motivo: "solicitud_usuario" | "queja" | "conflicto" | null;
} {
  if (HUMAN_RE.test(texto)) {
    return { handoff: true, motivo: "solicitud_usuario" };
  }
  if (QUEJA_RE.test(texto)) {
    return { handoff: true, motivo: "queja" };
  }
  if (CONFLICTO_RE.test(texto)) {
    return { handoff: true, motivo: "conflicto" };
  }
  return { handoff: false, motivo: null };
}

export function classifyIntentLexical(
  texto: string,
  pasoGuion: PasoGuion,
): IntentClasificado {
  const forced = detectForcedHandoff(texto);
  if (forced.handoff) return "solicitud_humana";

  if (DATOS_DUROS_RE.test(texto)) return "datos_duros";
  if (DOCUMENTAL_RE.test(texto)) return "pregunta_documental";

  if (pasoGuion !== "faq_libre") return "guion_captura";

  if (MONTO_RIESGO_RE.test(texto)) return "datos_duros";

  return "ambiguo";
}

/**
 * Orden duro de routing (D-BOT-1):
 * guion → handoff forzado → catálogo → RAG → safe
 */
export type RoutingDecision =
  | { kind: "silencio" }
  | { kind: "quota_hard" }
  | { kind: "handoff"; motivo: "solicitud_usuario" | "queja" | "conflicto" | "adjunto_no_soportado" | "cupo_ia" }
  | { kind: "guion" }
  | { kind: "catalogo" }
  | { kind: "rag" }
  | { kind: "safe" };

export function decideRoute(input: {
  estadoBot: "activo" | "escalado" | "humano";
  hardQuota: boolean;
  texto: string;
  pasoGuion: PasoGuion;
  capturaPendiente: boolean;
  adjuntoInvalido: boolean;
  intent: IntentClasificado;
}): RoutingDecision {
  if (input.estadoBot !== "activo") return { kind: "silencio" };
  if (input.hardQuota) return { kind: "quota_hard" };

  const forced = detectForcedHandoff(input.texto);
  if (forced.handoff && forced.motivo) {
    return { kind: "handoff", motivo: forced.motivo };
  }

  if (input.adjuntoInvalido) {
    return { kind: "handoff", motivo: "adjunto_no_soportado" };
  }

  if (input.capturaPendiente && input.intent !== "datos_duros" && input.intent !== "solicitud_humana") {
    // Precio interrumpe guion; resto sigue captura
    if (input.intent === "pregunta_documental" && input.pasoGuion === "faq_libre") {
      return { kind: "rag" };
    }
    if (input.capturaPendiente) return { kind: "guion" };
  }

  if (input.intent === "datos_duros") return { kind: "catalogo" };
  if (input.intent === "pregunta_documental") return { kind: "rag" };
  if (input.intent === "guion_captura") return { kind: "guion" };
  if (input.intent === "ambiguo" && MONTO_RIESGO_RE.test(input.texto)) {
    return { kind: "catalogo" };
  }
  if (input.intent === "ambiguo") return { kind: "rag" };

  return { kind: "safe" };
}

export function isAdjuntoSoportado(adj: {
  mimeType: string;
  sizeBytes?: number;
  duracionSec?: number;
}): boolean {
  const mime = adj.mimeType.toLowerCase();
  const okMime =
    mime.startsWith("image/") ||
    mime.startsWith("video/") ||
    mime === "application/pdf" ||
    mime.includes("word") ||
    mime.includes("sheet") ||
    mime === "text/csv";
  if (!okMime) return false;
  if (adj.sizeBytes != null && adj.sizeBytes > 25 * 1024 * 1024) return false;
  if (adj.duracionSec != null && adj.duracionSec > 300) return false;
  return true;
}
