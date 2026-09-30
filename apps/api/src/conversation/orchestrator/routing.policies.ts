import { HABLAR_ASESOR_PAYLOAD } from "@tres-cielos/shared";
import type { ConversationFlowVersion } from "../conversation-flow";
import {
  decideRutaComercial,
  decideRutaComercialV3,
  deriveEncaje,
  deriveEncajeV3,
  isAclaracionPisoPendiente,
  isCalificadoV3,
  isPrequalificadoV2,
} from "../conversation-flow";
import type {
  CamposCapturados,
  IntentClasificado,
  PasoGuion,
  RutaComercial,
} from "../types";
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
 * v2 añade nutrición, seguimiento y cola de atención general.
 */
export type RoutingDecision =
  | { kind: "silencio" }
  | { kind: "quota_hard" }
  | {
      kind: "handoff";
      motivo:
        | "solicitud_usuario"
        | "queja"
        | "conflicto"
        | "adjunto_no_soportado"
        | "cupo_ia"
        | "otro";
      cola?: "comercial" | "atencion_general";
      rutaComercial?: RutaComercial;
    }
  | { kind: "guion" }
  | { kind: "catalogo" }
  | { kind: "faq_comercial" }
  | { kind: "rag" }
  | { kind: "safe" }
  | { kind: "nutricion"; motivo: "menor_piso" | "evasion" }
  | { kind: "seguimiento" }
  | { kind: "jump_visita" }
  | { kind: "answer_inline" }
  | { kind: "degrade_script" }
  | { kind: "adjunto_retry" }
  | { kind: "safe_sin_escala"; motivo?: "rerank_bajo" | "sin_cita_rag" };

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
  recotizarPorSlots?: boolean;
  flow?: ConversationFlowVersion;
  campos?: CamposCapturados;
  adjuntoReintentos?: number;
}): RoutingDecision {
  if (input.estadoBot !== "activo") return { kind: "silencio" };
  if (input.hardQuota) {
    return input.flow === "v3"
      ? { kind: "degrade_script" }
      : { kind: "quota_hard" };
  }

  if ((input.flow ?? "v1") === "v3") {
    return decideRouteV3(input);
  }
  if ((input.flow ?? "v1") === "v2") {
    return decideRouteV2(input);
  }
  return decideRouteV1(input);
}

function decideRouteV1(
  input: Parameters<typeof decideRoute>[0],
): RoutingDecision {
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

function decideRouteV2(
  input: Parameters<typeof decideRoute>[0],
): RoutingDecision {
  const campos = input.campos ?? {};
  const encaje = deriveEncaje(campos);
  const forced = detectForcedHandoff(input.texto, input.buttonPayload);
  const humanAsk =
    (forced.handoff && forced.motivo === "solicitud_usuario") ||
    input.intent === "solicitud_humana";

  if (forced.handoff && forced.motivo && forced.motivo !== "solicitud_usuario") {
    return { kind: "handoff", motivo: forced.motivo };
  }
  if (input.adjuntoInvalido) {
    return { kind: "handoff", motivo: "adjunto_no_soportado" };
  }

  if (humanAsk) {
    if (encaje === "confirmado") {
      return {
        kind: "handoff",
        motivo: "solicitud_usuario",
        cola: "comercial",
        rutaComercial: "handoff",
      };
    }
    return {
      kind: "handoff",
      motivo: "solicitud_usuario",
      cola: "atencion_general",
      rutaComercial: "atencion_general",
    };
  }

  if (encaje === "no") {
    return { kind: "nutricion", motivo: "menor_piso" };
  }

  const comercial = matchCommercialFaqTopic(input.texto);
  if (comercial === "fecha_minima") {
    return { kind: "handoff", motivo: "otro" };
  }

  if (isPrequalificadoV2(campos)) {
    return { kind: "jump_visita" };
  }

  if (
    (campos.numeroMensajesCaptura ?? 0) >= 3 &&
    encaje !== "confirmado" &&
    !isAclaracionPisoPendiente(campos, input.pasoGuion)
  ) {
    return { kind: "nutricion", motivo: "evasion" };
  }

  if (input.capturaPendiente) {
    if (isLocationQuery(input.texto) && !isIntencionVisita(input.texto)) {
      return { kind: "faq_comercial" };
    }
    return { kind: "guion" };
  }

  const ruta = decideRutaComercial(campos);
  if (ruta === "seguimiento") return { kind: "seguimiento" };
  if (ruta === "nutricion") return { kind: "nutricion", motivo: "evasion" };
  if (ruta === "handoff") {
    return {
      kind: "handoff",
      motivo: "solicitud_usuario",
      cola: "comercial",
      rutaComercial: "handoff",
    };
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

function decideRouteV3(
  input: Parameters<typeof decideRoute>[0],
): RoutingDecision {
  const campos = input.campos ?? {};
  const encaje = deriveEncajeV3(campos);
  const forced = detectForcedHandoff(input.texto, input.buttonPayload);
  const humanAsk =
    (forced.handoff && forced.motivo === "solicitud_usuario") ||
    input.intent === "solicitud_humana";

  if (forced.handoff && forced.motivo && forced.motivo !== "solicitud_usuario") {
    return {
      kind: "handoff",
      motivo: forced.motivo,
      cola: "atencion_general",
      rutaComercial: "atencion_general",
    };
  }

  if (input.adjuntoInvalido) {
    if ((input.adjuntoReintentos ?? 0) >= 1) {
      return {
        kind: "handoff",
        motivo: "adjunto_no_soportado",
        cola: "atencion_general",
        rutaComercial: "atencion_general",
      };
    }
    return { kind: "adjunto_retry" };
  }

  if (humanAsk) {
    if (encaje === "confirmado") {
      return {
        kind: "handoff",
        motivo: "solicitud_usuario",
        cola: "comercial",
        rutaComercial: "handoff",
      };
    }
    return {
      kind: "handoff",
      motivo: "solicitud_usuario",
      cola: "atencion_general",
      rutaComercial: "atencion_general",
    };
  }

  if (encaje === "no") {
    return { kind: "nutricion", motivo: "menor_piso" };
  }

  const comercial = matchCommercialFaqTopic(input.texto);
  if (comercial === "fecha_minima") {
    return { kind: "faq_comercial" };
  }

  if (
    /\ba futuro\b/.test(input.texto.toLowerCase()) &&
    encaje !== "confirmado" &&
    encaje !== "probable"
  ) {
    return { kind: "nutricion", motivo: "evasion" };
  }

  const visita = isIntencionVisita(input.texto);
  if (
    visita &&
    campos.aforo != null &&
    (encaje === "confirmado" || encaje === "probable")
  ) {
    return { kind: "jump_visita" };
  }

  if (isCalificadoV3(campos) && (visita || campos.intencionVisita)) {
    return { kind: "jump_visita" };
  }

  if (isCalificadoV3(campos) && (encaje === "confirmado" || encaje === "probable")) {
    if (campos.intencionNivel === "alta" || campos.intencionNivel === "media") {
      return { kind: "jump_visita" };
    }
  }

  if (
    (campos.numeroMensajesCaptura ?? 0) >= 3 &&
    encaje !== "confirmado" &&
    encaje !== "probable" &&
    !isAclaracionPisoPendiente(campos, input.pasoGuion)
  ) {
    return { kind: "nutricion", motivo: "evasion" };
  }

  if (input.capturaPendiente) {
    if (isLocationQuery(input.texto) && !visita) {
      return { kind: "faq_comercial" };
    }
    if (comercial) {
      return { kind: "faq_comercial" };
    }
    if (input.intent === "datos_duros" || isPackageDetailQuery(input.texto)) {
      return { kind: "answer_inline" };
    }
    if (visita && encaje !== "confirmado" && encaje !== "probable") {
      return { kind: "guion" };
    }
    return { kind: "guion" };
  }

  if (
    campos.rutaComercial === "nutricion" &&
    encaje !== "confirmado" &&
    encaje !== "probable"
  ) {
    return { kind: "nutricion", motivo: "evasion" };
  }

  const ruta = decideRutaComercialV3(campos);
  if (ruta === "seguimiento") return { kind: "seguimiento" };
  if (ruta === "nutricion") return { kind: "nutricion", motivo: "evasion" };
  if (ruta === "handoff") {
    return {
      kind: "handoff",
      motivo: "solicitud_usuario",
      cola: "comercial",
      rutaComercial: "handoff",
    };
  }

  if (comercial) return { kind: "faq_comercial" };
  if (visita) return { kind: "faq_comercial" };
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
