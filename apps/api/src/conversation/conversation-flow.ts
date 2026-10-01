import type { ConfigService } from "@nestjs/config";
import type {
  AforoBanda,
  CamposCapturados,
  ConversacionState,
  EncajeEconomico,
  IntencionNivel,
  PasoGuion,
  RangoInversion,
  RangoPresupuestoFuera,
  RutaComercial,
} from "./types";

export type ConversationFlowVersion = "v1" | "v2" | "v3" | "v4";

export type CompletitudFit = "minima" | "comercial" | "vacia";

export interface FitScore {
  encaje: EncajeEconomico | null;
  intencion: IntencionNivel | null;
  completitud: CompletitudFit;
}

export const PISO_INVERSION_MXN = 250_000;

export const PASO_GUION_V2: PasoGuion[] = [
  "nombre_fecha",
  "aforo_inversion",
  "aclaracion_piso",
  "accion",
  "faq_libre",
];

const PASO_V1_TO_V2: Record<string, PasoGuion> = {
  saludo: "nombre_fecha",
  nombre: "nombre_fecha",
  ocasion: "nombre_fecha",
  fecha: "nombre_fecha",
  aforo: "aforo_inversion",
  sede: "aforo_inversion",
  presupuesto: "accion",
  intencion: "accion",
};

/**
 * Sin ConfigService (specs unitarios) el default es v1, aunque `.env` tenga v2.
 * Con config de Nest, el default de `conversation.flow` es v2.
 */
export function conversationFlowVersion(
  config?: ConfigService,
): ConversationFlowVersion {
  const raw = config?.get<string>("conversation.flow");
  if (raw === "v4") return "v4";
  if (raw === "v3") return "v3";
  if (raw === "v2") return "v2";
  if (raw === "v1") return "v1";
  return config ? "v2" : "v1";
}

export function conversationFlowCanaryPct(config?: ConfigService): number {
  const n = config?.get<number>("conversation.canaryPct");
  if (typeof n === "number" && Number.isFinite(n)) {
    return Math.min(100, Math.max(0, Math.trunc(n)));
  }
  const raw = process.env.CONVERSATION_FLOW_CANARY_PCT;
  const p = raw != null ? Number(raw) : 0;
  return Number.isFinite(p) ? Math.min(100, Math.max(0, Math.trunc(p))) : 0;
}

export function hashCanaryBucket(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h % 100;
}

export function resolveConversationFlow(
  config: ConfigService | undefined,
  seed: {
    threadId: string;
    sedeId?: string | null;
    persisted?: string | null;
  },
): ConversationFlowVersion {
  if (
    seed.persisted === "v1" ||
    seed.persisted === "v2" ||
    seed.persisted === "v3" ||
    seed.persisted === "v4"
  ) {
    return seed.persisted;
  }
  const base = conversationFlowVersion(config);
  if (base === "v4" || base === "v3" || base === "v1") return base;
  const pct = conversationFlowCanaryPct(config);
  if (pct <= 0) return "v2";
  const key = seed.sedeId?.trim() || seed.threadId;
  return hashCanaryBucket(key) < pct ? "v3" : "v2";
}

export function effectiveConversationFlow(
  conv: { guionVersion?: string | null },
  config?: ConfigService,
): ConversationFlowVersion {
  if (
    conv.guionVersion === "v1" ||
    conv.guionVersion === "v2" ||
    conv.guionVersion === "v3" ||
    conv.guionVersion === "v4"
  ) {
    return conv.guionVersion;
  }
  return conversationFlowVersion(config);
}

export function isV2Plus(flow: ConversationFlowVersion): boolean {
  return flow === "v2" || flow === "v3";
}

export function isFechaFocusedPaso(paso?: PasoGuion | null): boolean {
  return paso === "fecha" || paso === "nombre_fecha" || paso === "fecha_ventana";
}

export function isNombreFocusedPaso(paso?: PasoGuion | null): boolean {
  return (
    !paso ||
    paso === "saludo" ||
    paso === "nombre" ||
    paso === "nombre_fecha"
  );
}

export function isAforoFocusedPaso(paso?: PasoGuion | null): boolean {
  return paso === "aforo" || paso === "aforo_inversion";
}

export function mapPasoGuionV1ToV2(paso: PasoGuion): PasoGuion {
  return PASO_V1_TO_V2[paso] ?? paso;
}

export function initialPasoGuion(flow: ConversationFlowVersion): PasoGuion {
  if (flow === "v4") return "fecha_ventana";
  return isV2Plus(flow) ? "nombre_fecha" : "saludo";
}

export function applyDefaultBoda(campos: CamposCapturados): CamposCapturados {
  if (campos.tipoEvento) return campos;
  return { ...campos, tipoEvento: "boda" };
}

export function fechaEstadoFrom(
  campos: CamposCapturados,
): CamposCapturados["fechaEstado"] {
  const fecha = campos.fechaTentativa;
  if (!fecha) return "sin_definir";
  if (fecha.tipo === "dia") return "definida";
  if (fecha.tipo === "rango" || fecha.tipo === "mes") return "ventana";
  return "tentativa";
}

export function presupuestoFromRango(
  rango: RangoInversion | null | undefined,
): CamposCapturados["presupuestoOrientativo"] {
  if (!rango) return null;
  if (rango === "por_definir" || rango === "menor_250") {
    return rango === "menor_250" ? null : { tipo: "no_definido", moneda: "MXN" };
  }
  if (rango === "r250_349") {
    return { tipo: "rango", min: 250_000, max: 349_000, moneda: "MXN" };
  }
  if (rango === "r350_499") {
    return { tipo: "rango", min: 350_000, max: 499_000, moneda: "MXN" };
  }
  return { tipo: "rango", min: 500_000, moneda: "MXN" };
}

export function deriveEncaje(campos: CamposCapturados): EncajeEconomico | null {
  if (campos.encajeEconomico === "no" || campos.aceptaPiso250k === false) {
    return "no";
  }
  if (campos.aceptaPiso250k === true) return "confirmado";
  if (campos.rangoInversion && campos.rangoInversion !== "por_definir") {
    return "confirmado";
  }
  if (campos.rangoInversion === "por_definir") return "no_confirmado";
  if (campos.encajeEconomico === "probable") return "confirmado";
  if (campos.encajeEconomico) return campos.encajeEconomico;
  return null;
}

/** B3 aún no se preguntó: por_definir no es evasión. */
export function isAclaracionPisoPendiente(
  campos: CamposCapturados,
  pasoGuion?: PasoGuion | null,
): boolean {
  if (campos.aceptaPiso250k != null) return false;
  if (pasoGuion === "aclaracion_piso") return true;
  return (
    campos.rangoInversion === "por_definir" &&
    (campos.numeroAclaracionesPiso ?? 0) < 1
  );
}

export function syncCamposV2(campos: CamposCapturados): CamposCapturados {
  const next: CamposCapturados = { ...campos };
  next.fechaEstado = fechaEstadoFrom(next);
  const encaje = deriveEncaje(next);
  if (encaje) next.encajeEconomico = encaje;
  if (encaje === "confirmado" && next.aceptaPiso250k == null) {
    next.aceptaPiso250k = true;
  }
  if (next.rangoInversion) {
    next.presupuestoOrientativo = presupuestoFromRango(next.rangoInversion);
  }
  if (next.intencionNivel === "alta" || next.intencionNivel === "media") {
    if (next.intencionCotizar == null) next.intencionCotizar = true;
  }
  if (next.intencionNivel === "baja" && next.intencionCotizar == null) {
    next.intencionCotizar = false;
  }
  return next;
}

export function isPrequalificadoV2(campos: CamposCapturados): boolean {
  const encaje = deriveEncaje(campos);
  const nivel = campos.intencionNivel;
  return (
    encaje === "confirmado" &&
    Boolean(campos.fechaTentativa) &&
    campos.aforo != null &&
    nivel !== "baja"
  );
}

export function isCapturaPendienteV2(conv: ConversacionState): boolean {
  const c = conv.camposCapturados;
  if (conv.pasoGuion === "faq_libre") return false;
  const ruta = c.rutaComercial;
  if (
    ruta === "handoff" ||
    ruta === "atencion_general" ||
    ruta === "nutricion" ||
    ruta === "seguimiento" ||
    ruta === "cierre"
  ) {
    return false;
  }
  if (c.encajeEconomico === "no" && !isPresupuestoFueraPendiente(c)) return false;
  if (c.pdfEnviado && c.ctaGuion && !isPresupuestoFueraPendiente(c)) {
    return false;
  }
  if (isPrequalificadoV2(c)) return false;
  if (
    deriveEncaje(c) === "confirmado" &&
    c.intencionNivel === "baja" &&
    c.fechaTentativa
  ) {
    return false;
  }
  if (
    deriveEncaje(c) === "no_confirmado" &&
    (c.numeroAclaracionesPiso ?? 0) >= 1
  ) {
    return false;
  }
  return true;
}

export function nextPasoGuionV2(campos: CamposCapturados): PasoGuion {
  const c = syncCamposV2(campos);
  if (!c.nombre || !c.fechaTentativa) return "nombre_fecha";
  if (!c.pdfEnviado || !c.ctaGuion) return "accion";
  if (isPresupuestoFueraPendiente(c)) return "presupuesto_fuera";
  return "faq_libre";
}

export function decideRutaComercial(campos: CamposCapturados): RutaComercial | null {
  const encaje = deriveEncaje(campos);
  const nivel = campos.intencionNivel;
  if (encaje === "no") {
    if (isPresupuestoFueraPendiente(campos)) return null;
    return "nutricion";
  }
  if (encaje === "confirmado") {
    if (nivel === "baja") return "seguimiento";
    return "handoff";
  }
  if (
    encaje === "no_confirmado" &&
    (campos.numeroAclaracionesPiso ?? 0) >= 1 &&
    campos.aceptaPiso250k !== true
  ) {
    return "nutricion";
  }
  return null;
}

export function accionHandoffLabel(campos: CamposCapturados): "visita" | "cotización" {
  return campos.intencionVisita ? "visita" : "cotización";
}

export function deriveEncajeV3(campos: CamposCapturados): EncajeEconomico | null {
  if (campos.encajeEconomico === "no" || campos.aceptaPiso250k === false) {
    return "no";
  }
  if (campos.rangoInversion === "menor_250") return "no";
  if (campos.aceptaPiso250k === true) return "confirmado";
  if (campos.rangoInversion && campos.rangoInversion !== "por_definir") {
    return "confirmado";
  }
  if (campos.rangoInversion === "por_definir") {
    return campos.encajeEconomico === "probable" ? "probable" : "no_confirmado";
  }
  if (campos.encajeEconomico === "probable") return "probable";
  if (campos.encajeEconomico) return campos.encajeEconomico;
  return inferProbable(campos);
}

export function inferProbable(campos: CamposCapturados): EncajeEconomico | null {
  if (campos.encajeEconomico === "probable") return "probable";
  return null;
}

export function inferProbableFromTexto(texto: string): boolean {
  const t = texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return (
    /produccion completa|evento premium|paquete premium|boda premium/.test(t) ||
    /\b150\s*\+|mas de\s*150|m[aá]s de\s*150/.test(t) ||
    (/\bsabado\b/.test(t) && /premium|completo|jardin/.test(t))
  );
}

export function aforoBandaFrom(aforo: number | null | undefined): AforoBanda | null {
  if (aforo == null) return null;
  const bands: AforoBanda[] = [100, 150, 200, 250, 300];
  let best: AforoBanda = 100;
  let dist = Math.abs(aforo - 100);
  for (const b of bands) {
    const d = Math.abs(aforo - b);
    if (d < dist) {
      best = b;
      dist = d;
    }
  }
  return best;
}

export function scoreFit(campos: CamposCapturados): FitScore {
  const encaje = deriveEncajeV3(campos);
  const fechaEstado = campos.fechaEstado ?? fechaEstadoFrom(campos);
  const tieneFecha = fechaEstado != null && fechaEstado !== "sin_definir";
  let completitud: CompletitudFit = "vacia";
  if (campos.nombre && (tieneFecha || campos.aforo != null)) {
    completitud =
      encaje === "confirmado" || encaje === "probable" ? "comercial" : "minima";
  }
  return {
    encaje,
    intencion: campos.intencionNivel ?? null,
    completitud,
  };
}

export function isCalificadoV3(campos: CamposCapturados): boolean {
  const fit = scoreFit(campos);
  return (
    (fit.encaje === "confirmado" || fit.encaje === "probable") &&
    campos.aforo != null &&
    (fit.intencion === "alta" || fit.intencion === "media")
  );
}

export function syncCamposV3(campos: CamposCapturados): CamposCapturados {
  const next: CamposCapturados = { ...campos };
  next.fechaEstado = fechaEstadoFrom(next);
  const encaje = deriveEncajeV3(next);
  if (encaje) next.encajeEconomico = encaje;
  if (encaje === "confirmado" && next.aceptaPiso250k == null) {
    next.aceptaPiso250k = true;
  }
  if (next.rangoInversion) {
    next.presupuestoOrientativo = presupuestoFromRango(next.rangoInversion);
  }
  if (next.aforo != null) {
    next.aforoBanda = aforoBandaFrom(next.aforo);
  }
  if (next.intencionNivel === "alta" || next.intencionNivel === "media") {
    if (next.intencionCotizar == null) next.intencionCotizar = true;
  }
  if (next.intencionNivel === "baja" && next.intencionCotizar == null) {
    next.intencionCotizar = false;
  }
  return next;
}

export function isCapturaPendienteV3(conv: ConversacionState): boolean {
  const c = conv.camposCapturados;
  if (conv.pasoGuion === "faq_libre") return false;
  const ruta = c.rutaComercial;
  if (
    ruta === "handoff" ||
    ruta === "atencion_general" ||
    ruta === "nutricion" ||
    ruta === "seguimiento" ||
    ruta === "cierre"
  ) {
    return false;
  }
  if (deriveEncajeV3(c) === "no" && !isPresupuestoFueraPendiente(c)) {
    return false;
  }
  if (c.pdfEnviado && c.ctaGuion && !isPresupuestoFueraPendiente(c)) {
    return false;
  }
  if (isCalificadoV3(c)) return false;
  if (
    deriveEncajeV3(c) === "confirmado" &&
    c.intencionNivel === "baja" &&
    (c.fechaEstado !== "sin_definir" || c.fechaTentativa)
  ) {
    return false;
  }
  if (
    (deriveEncajeV3(c) === "no_confirmado" || deriveEncajeV3(c) === "probable") &&
    (c.numeroAclaracionesPiso ?? 0) >= 1
  ) {
    return false;
  }
  return true;
}

export function nextPasoGuionV3(campos: CamposCapturados): PasoGuion {
  const c = syncCamposV3(campos);
  if (!c.nombre || !c.fechaTentativa) return "nombre_fecha";
  if (!c.pdfEnviado || !c.ctaGuion) return "accion";
  if (isPresupuestoFueraPendiente(c)) return "presupuesto_fuera";
  return "faq_libre";
}

export function decideRutaComercialV3(campos: CamposCapturados): RutaComercial | null {
  const encaje = deriveEncajeV3(campos);
  const nivel = campos.intencionNivel;
  if (encaje === "no") {
    if (isPresupuestoFueraPendiente(campos)) return null;
    return "nutricion";
  }
  if (encaje === "confirmado") {
    if (nivel === "baja") return "seguimiento";
    return "handoff";
  }
  if (encaje === "probable" && nivel === "alta") return "handoff";
  if (
    (encaje === "no_confirmado" || encaje === "probable") &&
    (campos.numeroAclaracionesPiso ?? 0) >= 1 &&
    campos.aceptaPiso250k !== true
  ) {
    return "nutricion";
  }
  return null;
}

export function isPresupuestoFueraPendiente(campos: CamposCapturados): boolean {
  return (
    campos.ctaGuion === "fuera_presupuesto" && !campos.rangoPresupuestoFuera
  );
}

export function presupuestoFromRangoPresupuestoFuera(
  rango: RangoPresupuestoFuera,
): CamposCapturados["presupuestoOrientativo"] {
  if (rango === "r200_250") {
    return { tipo: "rango", min: 200_000, max: 250_000, moneda: "MXN" };
  }
  if (rango === "r250_300") {
    return { tipo: "rango", min: 250_000, max: 300_000, moneda: "MXN" };
  }
  return { tipo: "no_definido", moneda: "MXN" };
}

export function nextPasoGuionV4(campos: CamposCapturados): PasoGuion {
  if (!campos.fechaTentativa) return "fecha_ventana";
  if (!campos.nombre) return "nombre";
  if (!campos.ctaGuion) return "accion";
  if (isPresupuestoFueraPendiente(campos)) return "presupuesto_fuera";
  return "faq_libre";
}

export function isCapturaPendienteV4(conv: ConversacionState): boolean {
  const c = conv.camposCapturados;
  if (conv.pasoGuion === "faq_libre" || c.rutaComercial) return false;
  if (!c.ctaGuion) return true;
  return isPresupuestoFueraPendiente(c);
}

export function decideRutaComercialV4(campos: CamposCapturados): RutaComercial | null {
  if (campos.ctaGuion === "fuera_presupuesto") {
    if (!campos.rangoPresupuestoFuera) return null;
    return "nutricion";
  }
  if (campos.ctaGuion === "visita" || campos.ctaGuion === "ejecutivo") {
    return "handoff";
  }
  return null;
}

export function slaMinutos(cola?: "comercial" | "atencion_general" | null): number {
  return cola === "atencion_general" ? 30 : 15;
}

export function b2PreguntaV3(
  campos: CamposCapturados,
): "aforo" | "rango" | null {
  if (campos.aforo == null) return "aforo";
  if (!campos.rangoInversion) return "rango";
  return null;
}

export type EncajeEconomicoPublic = EncajeEconomico;
export type IntencionNivelPublic = IntencionNivel;
export type RangoInversionPublic = RangoInversion;
export type RutaComercialPublic = RutaComercial;
