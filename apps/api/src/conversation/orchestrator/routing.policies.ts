import { HABLAR_ASESOR_PAYLOAD } from "@tres-cielos/shared";
import type { IntentClasificado, PasoGuion } from "../types";
import {
  isPackageDetailQuery,
  matchCommercialFaqTopic,
} from "./commercial-faq.matcher";
import { DATOS_DUROS_RE, MONTO_RIESGO_RE } from "./monetary-intent";
import { isIntencionVisita } from "./visit-intent";
import { isLocationQuery } from "./location-intent";

const HUMAN_RE =
  /\b(hablar con (un |una )?(humano|asesor|persona|agente)|quiero (un )?asesor|pasame (con|a) (un )?humano|atenci[oó]n humana)\b/i;

const QUEJA_RE =
  /\b(queja|demanda|estafa|fraude|abusiv|p[eé]simo servicio|voy a demandar)\b/i;

const CONFLICTO_RE =
  /\b(abogad[oa]|legal|demandar|procon|profeco)\b/i;

/** Venue / ficha de sede. Políticas comerciales y horario de evento van a faq_comercial. */
const DOCUMENTAL_RE =
  /\b(ubicaci[oó]n|c[oó]mo lleg(?:ar|o)|direcci[oó]n|estacionamiento|dress code|faq|venue|jard[ií]n|descripci[oó]n|waze|maps|gps)\b/i;

export function detectForcedHandoff(
  texto: string,
  buttonPayload?: string | null,
): {
  handoff: boolean;
  motivo: "solicitud_usuario" | "queja" | "conflicto" | null;
} {
  if (buttonPayload === HABLAR_ASESOR_PAYLOAD) {
    return { handoff: true, motivo: "solicitud_usuario" };
  }
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
  buttonPayload?: string | null,
): IntentClasificado {
  const forced = detectForcedHandoff(texto, buttonPayload);
  if (forced.handoff) return "solicitud_humana";

  if (isPackageDetailQuery(texto) || DATOS_DUROS_RE.test(texto)) {
    return "datos_duros";
  }
  if (DOCUMENTAL_RE.test(texto) || isLocationQuery(texto)) {
    return "pregunta_documental";
  }

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
  | { kind: "handoff"; motivo: "solicitud_usuario" | "queja" | "conflicto" | "adjunto_no_soportado" | "cupo_ia" | "otro" }
  | { kind: "guion" }
  | { kind: "catalogo" }
  | { kind: "faq_comercial" }
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
  buttonPayload?: string | null;
  pedidoCotizacion?: boolean;
  perfilListo?: boolean;
  /** Harvest de este turno corrigió fecha/aforo con perfil listo e intención de cotizar. */
  recotizarPorSlots?: boolean;
}): RoutingDecision {
  if (input.estadoBot !== "activo") return { kind: "silencio" };
  if (input.hardQuota) return { kind: "quota_hard" };

  const forced = detectForcedHandoff(input.texto, input.buttonPayload);
  if (forced.handoff && forced.motivo) {
    return { kind: "handoff", motivo: forced.motivo };
  }
  if (input.intent === "solicitud_humana") {
    return { kind: "handoff", motivo: "solicitud_usuario" };
  }

  if (input.adjuntoInvalido) {
    return { kind: "handoff", motivo: "adjunto_no_soportado" };
  }

  const comercial = matchCommercialFaqTopic(input.texto);
  if (comercial === "fecha_minima") {
    return { kind: "handoff", motivo: "otro" };
  }

  // D-BOT-1: captura de guion gana a precio/paquete hasta nombre + ocasión + fecha + aforo.
  // Excepción: pregunta de ubicación (no visita) es hecho cerrado, no RAG.
  if (input.capturaPendiente) {
    if (isLocationQuery(input.texto) && !isIntencionVisita(input.texto)) {
      return { kind: "faq_comercial" };
    }
    return { kind: "guion" };
  }

  if (comercial) return { kind: "faq_comercial" };
  if (isIntencionVisita(input.texto)) return { kind: "faq_comercial" };
  if (input.intent === "datos_duros") return { kind: "catalogo" };
  if (input.intent === "pregunta_documental") return { kind: "rag" };
  if (
    input.recotizarPorSlots &&
    input.pasoGuion === "faq_libre" &&
    input.perfilListo
  ) {
    return { kind: "catalogo" };
  }
  if (
    input.intent === "guion_captura" &&
    input.pedidoCotizacion &&
    input.perfilListo
  ) {
    return { kind: "catalogo" };
  }
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
