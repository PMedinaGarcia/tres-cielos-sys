import { anioTarifaPublicada, SEDE_ID, SEDE_NOMBRE } from "@tres-cielos/shared";
import {
  aforoBandaFrom,
  fechaEstadoFrom,
  inferProbableFromTexto,
  isAforoFocusedPaso,
  isFechaFocusedPaso,
  isNombreFocusedPaso,
  presupuestoFromRango,
  presupuestoFromRangoPresupuestoFuera,
} from "../conversation-flow";
import {
  DATOS_DUROS_RE,
  isIntencionMonetaria,
} from "../orchestrator/monetary-intent";
import { stripAccents } from "../text-normalize";
import type {
  CamposCapturados,
  CtaGuion,
  RangoPresupuestoFuera,
  FechaTentativa,
  FechaTipo,
  PasoGuion,
} from "../types";
import {
  explainFechaTentativa,
  fechaTentativaToIso,
  isoToFechaTentativa,
  tieneAnioExplicito,
  type FechaParseMotivo,
} from "./fecha-tentativa.parser";
import {
  applyRangoHarvest,
  parseAceptaPiso,
  parseIntencionNivel,
  parseRangoInversion,
} from "./harvest-rango";
import type { LlmPasoExtract } from "./script-llm.extract";

export type AforoParseMotivo = "sin_numero" | "unidad_invalida" | "fuera_rango";

export type AforoParseResult =
  | { ok: true; aforo: number }
  | { ok: false; motivo: AforoParseMotivo; fragmento?: string };

export type HarvestFilledKey = keyof CamposCapturados;

export interface HarvestResult {
  campos: CamposCapturados;
  filled: HarvestFilledKey[];
  fechaMotivo?: FechaParseMotivo;
  aforoMotivo?: AforoParseMotivo;
  aforoFragmento?: string;
}

const AFORO_UNIDADES = /^(pax|personas|invitados|gente)$/i;
const AFORO_UNIDAD_TOKEN = "pax|personas|invitados|gente";
const MES_PARA_FECHA =
  "enero|ene|febrero|feb|marzo|mar|abril|abr|mayo|may|junio|jun|julio|jul|agosto|ago|septiembre|setiembre|sep|sept|octubre|oct|noviembre|nov|diciembre|dic";

const MESES_ES = [
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

export function assignSedeUnica(campos: CamposCapturados): void {
  campos.sedeNombre = SEDE_NOMBRE;
  campos.sedeId = SEDE_ID;
}

export function isGuionCompleto(campos: CamposCapturados): boolean {
  return isPerfilListo(campos) && campos.intencionCotizar === true;
}

/** Perfil capturable sin exigir intención de cotizar. */
export function isPerfilListo(campos: CamposCapturados): boolean {
  return Boolean(
    campos.nombre &&
      campos.tipoEvento &&
      campos.fechaTentativa &&
      campos.aforo != null &&
      (campos.sedeId || campos.sedeNombre),
  );
}

export type PedidoCotizacionFuente =
  | "texto_monetario"
  | "afirmacion_stage"
  | "intencion_previa"
  | "rechazo"
  | "sin_pedido";

export type PedidoCotizacionResult = {
  evaluable: boolean;
  pedido: boolean | null;
  fuente: PedidoCotizacionFuente | null;
};

/**
 * Veredicto de este turno: ¿el lead pidió cotizar?
 * Solo evaluable con perfil listo. `intencion_previa` aplica al completar
 * el guion (paso ≠ faq_libre), no a preguntas sueltas en faq_libre.
 */
export function evaluarPedidoCotizacion(input: {
  texto: string;
  pasoGuion: PasoGuion;
  campos: CamposCapturados;
  perfilListo?: boolean;
}): PedidoCotizacionResult {
  const perfilListo = input.perfilListo ?? isPerfilListo(input.campos);
  if (!perfilListo) {
    return { evaluable: false, pedido: null, fuente: null };
  }
  const texto = input.texto.trim();
  const pasoIntencion =
    input.pasoGuion === "intencion" ||
    input.pasoGuion === "presupuesto" ||
    input.pasoGuion === "accion" ||
    input.pasoGuion === "aclaracion_piso";
  const siNo = extractSiNo(texto);
  if (pasoIntencion && siNo === false) {
    return { evaluable: true, pedido: false, fuente: "rechazo" };
  }
  if (isIntencionMonetaria(texto) || isFraseInteresCotizar(texto)) {
    return { evaluable: true, pedido: true, fuente: "texto_monetario" };
  }
  if (pasoIntencion && siNo === true) {
    return { evaluable: true, pedido: true, fuente: "afirmacion_stage" };
  }
  if (
    input.campos.intencionCotizar === true &&
    input.pasoGuion !== "faq_libre"
  ) {
    return { evaluable: true, pedido: true, fuente: "intencion_previa" };
  }
  return { evaluable: true, pedido: false, fuente: "sin_pedido" };
}

/** Query de catálogo cuando el texto del turno no es monetario (p. ej. el nombre). */
export function composePedidoCatalogoFromCampos(
  campos: CamposCapturados,
): string {
  const tipo = campos.tipoEvento?.trim() || "evento";
  const aforo =
    campos.aforo != null ? ` para ${campos.aforo} invitados` : "";
  const fecha = fechaTentativaToIso(campos.fechaTentativa ?? null);
  const cuando = fecha ? ` el ${fecha}` : "";
  return `Cotizar paquetes de ${tipo}${aforo}${cuando}`;
}

export function nextPasoGuion(campos: CamposCapturados): PasoGuion {
  if (!campos.nombre) return "nombre";
  if (!campos.tipoEvento) return "ocasion";
  if (!campos.fechaTentativa) return "fecha";
  if (campos.aforo == null) return "aforo";
  if (!campos.sedeId && !campos.sedeNombre) {
    assignSedeUnica(campos);
  }
  if (campos.intencionCotizar == null) return "intencion";
  return "faq_libre";
}

/** Vacío, upgrade mes→día, o corrección con año explícito y ISO distinto. */
export function shouldReplaceFecha(
  prev: FechaTentativa | null | undefined,
  nextFecha: FechaTentativa,
  texto: string,
): boolean {
  if (!prev) return true;
  if (nextFecha.tipo === "dia" && prev.tipo === "mes") return true;
  return (
    tieneAnioExplicito(texto) &&
    fechaTentativaToIso(nextFecha) !== fechaTentativaToIso(prev)
  );
}

/** Vacío o número distinto. El parseo harvest ya exige unidad o «para N», no el día de una fecha. */
export function shouldReplaceAforo(
  prev: number | null | undefined,
  nextAforo: number,
): boolean {
  if (prev == null) return true;
  return nextAforo !== prev;
}

const SLOTS_RECOTIZACION: HarvestFilledKey[] = ["fechaTentativa", "aforo"];

/** En faq_libre, una corrección de fecha/aforo reabre catálogo si ya hay pedido de cotizar. */
export function isRecotizarPorSlots(input: {
  pasoGuion: PasoGuion;
  perfilListo: boolean;
  intencionCotizar?: boolean | null;
  filled: HarvestFilledKey[];
}): boolean {
  if (input.pasoGuion !== "faq_libre") return false;
  if (!input.perfilListo || input.intencionCotizar !== true) return false;
  return input.filled.some((k) => SLOTS_RECOTIZACION.includes(k));
}

export function harvestCamposLexical(
  texto: string,
  campos: CamposCapturados,
  opts?: { focusedPaso?: PasoGuion; now?: Date },
): HarvestResult {
  const next: CamposCapturados = { ...campos };
  const filled: HarvestFilledKey[] = [];
  const focused = opts?.focusedPaso === "presupuesto" ? "intencion" : opts?.focusedPaso;
  const trimmed = texto.trim();
  let aforoFragmento: string | undefined;

  const mark = (key: HarvestFilledKey) => {
    if (!filled.includes(key)) filled.push(key);
  };

  if (next.nombre && !looksLikePersonName(next.nombre)) {
    delete next.nombre;
  }

  const tipo = extractTipoEvento(trimmed);
  if (tipo && tipo !== next.tipoEvento) {
    if (!(tipo === "otro" && next.tipoEvento)) {
      next.tipoEvento = tipo;
      mark("tipoEvento");
    }
  }

  const ventana =
    focused === "fecha_ventana" || focused === "nombre_fecha"
      ? parseFechaVentana(trimmed)
      : null;
  const fechaParsed = ventana
    ? ({ ok: true, fecha: ventana } as const)
    : explainFechaTentativa(trimmed, {
        now: opts?.now,
        paso: isFechaFocusedPaso(focused) ? "fecha" : focused,
      });
  let fechaMotivo: FechaParseMotivo | undefined;
  if (fechaParsed.ok) {
    if (shouldReplaceFecha(next.fechaTentativa, fechaParsed.fecha, trimmed)) {
      next.fechaTentativa = fechaParsed.fecha;
      mark("fechaTentativa");
    }
  } else {
    fechaMotivo = fechaParsed.motivo;
  }

  const aforoParsed = parseAforo(trimmed, {
    modo: aforoHarvestModo(focused, trimmed),
  });
  let aforoMotivo: AforoParseMotivo | undefined;
  if (aforoParsed.ok) {
    if (shouldReplaceAforo(next.aforo, aforoParsed.aforo)) {
      next.aforo = aforoParsed.aforo;
      mark("aforo");
    }
  } else {
    aforoMotivo = aforoParsed.motivo;
    if ("fragmento" in aforoParsed) aforoFragmento = aforoParsed.fragmento;
  }

  if (next.aforo != null && !next.sedeId && !next.sedeNombre) {
    assignSedeUnica(next);
    mark("sedeId");
    mark("sedeNombre");
  }

  if (next.intencionCotizar == null) {
    if (isFraseInteresCotizar(trimmed)) {
      next.intencionCotizar = true;
      mark("intencionCotizar");
    } else if (focused === "intencion" || focused === "accion") {
      const siNo = extractSiNo(trimmed);
      if (siNo != null) {
        next.intencionCotizar = siNo;
        mark("intencionCotizar");
      }
    }
  }

  const rangoPatch = applyRangoHarvest(trimmed, next);
  if (rangoPatch.rangoInversion && rangoPatch.rangoInversion !== next.rangoInversion) {
    next.rangoInversion = rangoPatch.rangoInversion;
    mark("rangoInversion");
  }
  if (
    rangoPatch.encajeEconomico &&
    rangoPatch.encajeEconomico !== next.encajeEconomico
  ) {
    next.encajeEconomico = rangoPatch.encajeEconomico;
    mark("encajeEconomico");
  }

  const nivel = parseIntencionNivel(trimmed);
  if (nivel && !next.intencionNivel) {
    next.intencionNivel = nivel;
    mark("intencionNivel");
  }

  if (focused === "accion" && !next.ctaGuion) {
    const cta = parseCtaGuion(trimmed);
    if (cta) {
      next.ctaGuion = cta;
      mark("ctaGuion");
      if (cta === "visita") {
        next.intencionVisita = true;
        next.intencionNivel = "alta";
      } else if (cta === "fuera_presupuesto") {
        next.encajeEconomico = "no";
      }
    }
  }

  if (focused === "presupuesto_fuera" && !next.rangoPresupuestoFuera) {
    const rangoFuera = parseRangoPresupuestoFuera(trimmed);
    if (rangoFuera) {
      next.rangoPresupuestoFuera = rangoFuera;
      mark("rangoPresupuestoFuera");
      next.presupuestoOrientativo =
        presupuestoFromRangoPresupuestoFuera(rangoFuera);
      next.encajeEconomico = "no";
      mark("encajeEconomico");
    }
  }

  if (focused === "aclaracion_piso" && next.aceptaPiso250k == null) {
    const acepta = parseAceptaPiso(trimmed);
    if (acepta != null) {
      next.aceptaPiso250k = acepta;
      mark("aceptaPiso250k");
      if (acepta) {
        next.encajeEconomico = "confirmado";
        next.intencionVisita = true;
        if (!next.intencionNivel) next.intencionNivel = "alta";
        mark("encajeEconomico");
      } else {
        next.encajeEconomico = "no";
        mark("encajeEconomico");
      }
    }
  }

  const fechaTipo = extractFechaTipo(trimmed);
  if (fechaTipo && !next.fechaTipo) {
    next.fechaTipo = fechaTipo;
    mark("fechaTipo");
  }

  const email = extractEmail(trimmed);
  if (email && !next.email) {
    next.email = email;
    mark("email");
  }

  const zona = extractOrigenZona(trimmed);
  if (zona && !next.origenZona) {
    next.origenZona = zona;
    mark("origenZona");
  }

  if (
    !next.encajeEconomico &&
    !next.rangoInversion &&
    inferProbableFromTexto(trimmed)
  ) {
    next.encajeEconomico = "probable";
    mark("encajeEconomico");
  }

  if (next.aforo != null) {
    next.aforoBanda = aforoBandaFrom(next.aforo);
  }

  next.fechaEstado = fechaEstadoFrom(next);
  if (next.rangoInversion) {
    next.presupuestoOrientativo = presupuestoFromRango(next.rangoInversion);
  }
  if (next.encajeEconomico === "confirmado" && next.aceptaPiso250k == null) {
    next.aceptaPiso250k = true;
  }
  if (next.intencionNivel === "alta" || next.intencionNivel === "media") {
    if (next.intencionCotizar == null) next.intencionCotizar = true;
  }

  const nombre = extractNombre(trimmed, {
    nombreExistente: next.nombre,
    focusedPaso: focused,
  });
  if (nombre && !next.nombre) {
    next.nombre = nombre;
    mark("nombre");
  }

  return { campos: next, filled, fechaMotivo, aforoMotivo, aforoFragmento };
}

export function mergeLlmExtract(
  campos: CamposCapturados,
  extracted: LlmPasoExtract,
  texto: string,
  opts?: { focusedPaso?: PasoGuion },
): { campos: CamposCapturados; filled: HarvestFilledKey[] } {
  const next: CamposCapturados = { ...campos };
  const filled: HarvestFilledKey[] = [];
  const mark = (key: HarvestFilledKey) => {
    if (!filled.includes(key)) filled.push(key);
  };

  if (next.nombre && !looksLikePersonName(next.nombre)) {
    delete next.nombre;
  }

  if (
    !next.nombre &&
    extracted.nombre &&
    looksLikePersonName(extracted.nombre) &&
    extractNombre(texto, {
      nombreExistente: next.nombre,
      focusedPaso: opts?.focusedPaso,
    })
  ) {
    next.nombre = extracted.nombre;
    mark("nombre");
  }
  if (!next.tipoEvento && extracted.tipoEvento) {
    next.tipoEvento = extracted.tipoEvento;
    mark("tipoEvento");
  }
  if (
    extracted.fechaTentativa &&
    shouldReplaceFecha(next.fechaTentativa, extracted.fechaTentativa, texto)
  ) {
    next.fechaTentativa = extracted.fechaTentativa;
    mark("fechaTentativa");
  }
  if (extracted.aforo != null) {
    if (next.aforo == null) {
      next.aforo = extracted.aforo;
      mark("aforo");
    } else {
      const lexical = parseAforo(texto, {
        modo: aforoHarvestModo(opts?.focusedPaso, texto),
      });
      if (lexical.ok && shouldReplaceAforo(next.aforo, extracted.aforo)) {
        next.aforo = extracted.aforo;
        mark("aforo");
      }
    }
  }
  if (extracted.sedeConfirmada === true && !next.sedeId && !next.sedeNombre) {
    assignSedeUnica(next);
    mark("sedeId");
    mark("sedeNombre");
  }
  if (next.intencionCotizar == null && extracted.intencionCotizar != null) {
    next.intencionCotizar = extracted.intencionCotizar;
    mark("intencionCotizar");
  }
  if (next.aforo != null && !next.sedeId && !next.sedeNombre) {
    assignSedeUnica(next);
    mark("sedeId");
    mark("sedeNombre");
  }
  return { campos: next, filled };
}

export function shouldCallLlmHarvest(
  texto: string,
  harvest: HarvestResult,
  focused: PasoGuion,
): boolean {
  if (harvest.fechaMotivo === "sin_anio" || harvest.fechaMotivo === "pasada") {
    return false;
  }
  if (
    harvest.aforoMotivo === "unidad_invalida" ||
    harvest.aforoMotivo === "fuera_rango"
  ) {
    return false;
  }
  const t = texto.trim();
  if (t.length < 8) return false;
  if (/^(hola|ola|hey|buenas|si|sí|sip|no|ok|va|dale)$/i.test(t)) return false;
  if (nextPasoGuion(harvest.campos) === "faq_libre" && focused === "faq_libre") {
    return false;
  }
  return true;
}

export function resumenCamposCapturados(
  campos: CamposCapturados,
): string | null {
  const parts: string[] = [];
  if (campos.tipoEvento) parts.push(campos.tipoEvento);
  const fecha = formatFechaHumana(campos.fechaTentativa ?? null);
  if (fecha) parts.push(`el ${fecha}`);
  if (campos.aforo != null) parts.push(`para ${campos.aforo} invitados`);
  if (parts.length === 0) return null;
  return parts.join(" ");
}

const NAME_PARTICLE = /^(de|del|la|los|las|y)$/i;
const NAME_TOKEN = /^[a-z]+(?:-[a-z]+)*$/i;
const NAME_STOP =
  /^(y|quiero|necesito|reservo|reservar|cotizar|cotizacion|pero|porque|para)$/i;

export function looksLikePersonName(value: string): boolean {
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (!cleaned || cleaned.length < 2 || cleaned.length > 80) return false;
  if (/[0-9@:/\\.]/.test(cleaned) || /https?:/i.test(cleaned)) return false;

  const tokens = cleaned.split(" ");
  if (tokens.length < 1 || tokens.length > 5) return false;
  if (NAME_PARTICLE.test(tokens[0]) || NAME_PARTICLE.test(tokens[tokens.length - 1])) {
    return false;
  }

  const normalized = stripAccents(cleaned.toLowerCase());
  if (hasRejectedNameLexeme(normalized)) return false;
  if (parseFechaVentana(value)) return false;

  let nameTokens = 0;
  for (const tok of tokens) {
    const letters = stripAccents(tok);
    if (NAME_PARTICLE.test(letters)) continue;
    if (!NAME_TOKEN.test(letters) || letters.length < 2) return false;
    nameTokens += 1;
  }
  return nameTokens >= 1;
}

export function extractNombre(
  texto: string,
  opts?: { nombreExistente?: string | null; focusedPaso?: PasoGuion },
): string | null {
  if (parseFechaVentana(texto.trim())) return null;
  if (opts?.nombreExistente && !hasNameCue(texto)) return null;
  if (extractSiNo(texto) != null && !hasNameCue(texto)) return null;
  if (isFrasePeticionOInteres(texto) && !hasNameCue(texto)) return null;

  const looksLikeEvent = Boolean(extractTipoEvento(texto));
  if (looksLikeEvent && !hasNameCue(texto)) return null;

  const pasoNombre = isNombreFocusedPaso(opts?.focusedPaso);
  if (!pasoNombre && !hasNameCue(texto)) return null;

  let cleaned = texto.trim();
  for (let i = 0; i < 3; i += 1) {
    const next = cleaned.replace(
      /^(hola|ola|hey|buenas?|qu[eé] tal|que tal|k tal)[\s,!.]*/i,
      "",
    );
    if (next === cleaned) break;
    cleaned = next;
  }
  const soy = cleaned.match(
    /\b(?:me llamo|soy|mi nombre es)\s+(.+)$/i,
  );
  if (soy) cleaned = soy[1];
  cleaned = takeNameSpan(cleaned);
  cleaned = cleaned.replace(/[.,!?]+$/g, "").trim().replace(/\s+/g, " ");
  if (cleaned.length < 2 || cleaned.length > 80) return null;
  if (/^\d+$/.test(cleaned)) return null;
  if (/^(hola|ola|hey|buenas|si|sí|no|ok)$/i.test(cleaned)) return null;
  if (/^(si|sí)\b/i.test(cleaned) && !hasNameCue(texto)) return null;
  if (!looksLikePersonName(cleaned)) return null;
  return cleaned;
}

export function extractTipoEvento(texto: string): string | null {
  const t = stripAccents(texto.toLowerCase());
  if (/boda|voda|casamiento|wedding/.test(t)) return "boda";
  if (/\bxv\b|quinceanera|quince anos|15 anos|quince/.test(t)) return "xv";
  if (/corporativ/.test(t)) return "corporativo";
  if (/social/.test(t)) return "social";
  if (/\botro (tipo|evento|ocasion)\b/.test(t) || /\bocasion\.otro\b/.test(t)) {
    return "otro";
  }
  return null;
}

export function parseAforo(
  texto: string,
  opts?: { modo?: "paso" | "harvest" },
): AforoParseResult {
  const modo = opts?.modo ?? "paso";
  if (modo === "harvest") return parseAforoHarvest(texto);
  return parseAforoPaso(texto);
}

function aforoHarvestModo(
  focused: PasoGuion | undefined,
  texto: string,
): "paso" | "harvest" {
  if (!isAforoFocusedPaso(focused)) return "harvest";
  const t = texto.trim();
  if (/^inversion\./i.test(t) || parseRangoInversion(t) != null) {
    return "harvest";
  }
  return "paso";
}

/** Opciones del list-picker v4 (id `fecha.*` o su título). Ene-May / Jun-Sep / Oct-Dic anclan al año de tarifa. */
export function parseFechaVentana(texto: string): FechaTentativa | null {
  const t = stripAccents(texto.toLowerCase()).trim().replace(/\s+/g, "");
  const anio = anioTarifaPublicada();
  const rango = (y: number, desde: string, hasta: string): FechaTentativa => ({
    tipo: "rango",
    desde: `${y}-${desde}`,
    hasta: `${y}-${hasta}`,
    anio: y,
    flexible: true,
  });
  if (/^(fecha\.ene_may|ene-may|enero-mayo)$/.test(t)) {
    return rango(anio, "01-01", "05-31");
  }
  if (/^(fecha\.jun_sep|jun-sep|junio-septiembre)$/.test(t)) {
    return rango(anio, "06-01", "09-30");
  }
  if (/^(fecha\.oct_dic|oct-dic|octubre-diciembre)$/.test(t)) {
    return rango(anio, "10-01", "12-31");
  }
  if (/^(fecha\.anio_2028|2028)$/.test(t)) {
    return rango(2028, "01-01", "12-31");
  }
  return null;
}

const RANGO_PRESUPUESTO_FUERA_POR_PAYLOAD: Record<string, RangoPresupuestoFuera> =
  {
    "presupuesto.r200_250": "r200_250",
    "presupuesto.r250_300": "r250_300",
    "presupuesto.fuera_rango": "fuera_rango",
  };

export function parseRangoPresupuestoFuera(
  texto: string,
): RangoPresupuestoFuera | null {
  const raw = texto.trim();
  const fromPayload = RANGO_PRESUPUESTO_FUERA_POR_PAYLOAD[raw];
  if (fromPayload) return fromPayload;
  const t = stripAccents(raw.toLowerCase());
  if (/^200\s*[–\-a]\s*250|200\s*-\s*250|200\s*a\s*250/.test(t)) {
    return "r200_250";
  }
  if (/^250\s*[–\-a]\s*300|250\s*-\s*300|250\s*a\s*300/.test(t)) {
    return "r250_300";
  }
  if (/fuera de rango|debajo de 200|menos de 200/.test(t)) {
    return "fuera_rango";
  }
  return null;
}

export function parseCtaGuion(texto: string): CtaGuion | null {
  const t = stripAccents(texto.toLowerCase()).trim();
  if (/^accion\.visita$|\b(agendar|visita|visitar)\b/.test(t)) return "visita";
  if (/^accion\.ejecutivo$|\bejecutiv/.test(t)) return "ejecutivo";
  if (
    /^accion\.fuera_presupuesto$|fuera de (tu|mi|nuestro) presupuesto|muy caro|no nos alcanza/.test(t)
  ) {
    return "fuera_presupuesto";
  }
  return null;
}

export function extractSiNo(texto: string): boolean | null {
  const t = stripAccents(texto.toLowerCase()).trim();
  if (
    /^(si|sip|ok|va|dale|yes|sale)\b/.test(t) ||
    /\b(claro|obvio|por supuesto|quiero cotizar|confirmo)\b/.test(t) ||
    /\b(estoy|me)\s+interesad/.test(t) ||
    /\bme interesa\b/.test(t)
  ) {
    return true;
  }
  if (/^(no|nel|nop)\b|ahora no|luego/.test(t)) return false;
  return null;
}

export function isFraseInteresCotizar(texto: string): boolean {
  if (DATOS_DUROS_RE.test(texto)) return true;
  const t = stripAccents(texto.toLowerCase());
  return (
    /\b(estoy|me)\s+interesad/.test(t) ||
    /\bme interesa\b/.test(t) ||
    /\bquiero cotizar\b/.test(t)
  );
}

/** Rellena slots vacíos desde args de tools; nunca escribe el default `boda` sin anclaje en el texto. */
export function applyCatalogWriteback(
  campos: CamposCapturados,
  args: Record<string, unknown>,
  texto: string,
): CamposCapturados {
  const next: CamposCapturados = { ...campos };
  if (next.aforo == null && typeof args.aforo === "number") {
    const n = Math.round(args.aforo);
    if (n >= 1 && n <= 5000) next.aforo = n;
  }
  if (!next.fechaTentativa && typeof args.fecha === "string") {
    const fecha = isoToFechaTentativa(args.fecha);
    if (fecha) next.fechaTentativa = fecha;
  }
  if (!next.tipoEvento) {
    const fromText = extractTipoEvento(texto);
    if (fromText) next.tipoEvento = fromText;
  }
  if (next.aforo != null && !next.sedeId && !next.sedeNombre) {
    assignSedeUnica(next);
  }
  return next;
}

function hasNameCue(texto: string): boolean {
  return /\b(?:me llamo|soy|mi nombre es)\b/i.test(texto);
}

function isFrasePeticionOInteres(texto: string): boolean {
  const t = stripAccents(texto.toLowerCase());
  return (
    /interesad/.test(t) ||
    /cotiz/.test(t) ||
    /precio/.test(t) ||
    /necesito/.test(t) ||
    /ayud/.test(t) ||
    /\bquiero\b/.test(t) ||
    /reserv/.test(t) ||
    /\binfo\b/.test(t) ||
    /informacion/.test(t) ||
    /disponib/.test(t) ||
    /agend/.test(t) ||
    /visitar/.test(t) ||
    /hablar/.test(t)
  );
}

function takeNameSpan(raw: string): string {
  const tokens = raw.trim().split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (const tok of tokens) {
    const hadComma = tok.includes(",");
    const stripped = tok.replace(/[.,!?]+$/g, "");
    if (!stripped) break;
    if (out.length > 0 && NAME_STOP.test(stripAccents(stripped))) break;
    if (out.length === 0 && NAME_STOP.test(stripAccents(stripped))) break;
    out.push(stripped);
    if (hadComma || out.length >= 5) break;
  }
  return out.join(" ");
}

function hasRejectedNameLexeme(normalized: string): boolean {
  if (
    /\b(quiero|necesito|info|precio|paquete|paquetes|hablar|asesor|horario|horarios|cuanto|pax|gente|hola|ola|hey|buenas|buenos|dias|tardes|noches|ok|si|sip|no)\b/.test(
      normalized,
    )
  ) {
    return true;
  }
  if (
    /reserv|cotiz|informacion|disponib|agend|visit|ayud|invitad|persona/.test(
      normalized,
    )
  ) {
    return true;
  }
  for (const mes of MESES_ES) {
    if (new RegExp(`\\b${stripAccents(mes)}\\b`).test(normalized)) return true;
  }
  return false;
}

function parseAforoPaso(texto: string): AforoParseResult {
  const m = texto.match(/(\d{1,4})(?:\s*([a-záéíóúüñ]+))?/i);
  if (!m) return { ok: false, motivo: "sin_numero" };
  return validateAforoNumber(Number(m[1]), m[2], m[0]);
}

function parseAforoHarvest(texto: string): AforoParseResult {
  const withUnit = new RegExp(
    `(\\d{1,4})\\s*(${AFORO_UNIDAD_TOKEN})\\b`,
    "i",
  ).exec(texto);
  if (withUnit) {
    return validateAforoNumber(Number(withUnit[1]), withUnit[2], withUnit[0]);
  }
  const para = new RegExp(
    `\\bpara\\s+(\\d{1,4})(?!\\s+(?:de\\s+)?(?:${MES_PARA_FECHA}))\\b`,
    "i",
  ).exec(texto);
  if (para) {
    return validateAforoNumber(Number(para[1]), undefined, para[0]);
  }
  const unas = new RegExp(
    `\\b(?:unas?|como|alrededor de|aprox(?:imadamente)?)\\s+(\\d{1,4})\\b`,
    "i",
  ).exec(texto);
  if (unas) {
    return validateAforoNumber(Number(unas[1]), undefined, unas[0]);
  }
  const suelto = texto
    .trim()
    .match(/^(?:son |somos |ser[ií]an )?(?:unos |unas )?(\d{2,3})\s*$/i);
  if (suelto) {
    return validateAforoNumber(Number(suelto[1]), undefined, suelto[0]);
  }
  return { ok: false, motivo: "sin_numero" };
}

export function extractFechaTipo(texto: string): FechaTipo | null {
  const t = stripAccents(texto.toLowerCase());
  if (/\bsabado\b/.test(t)) return "sabado";
  if (/\bviernes\b/.test(t)) return "viernes";
  return null;
}

export function extractEmail(texto: string): string | null {
  const m = texto.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return m ? m[0].toLowerCase() : null;
}

export function extractOrigenZona(texto: string): string | null {
  const t = stripAccents(texto.toLowerCase());
  if (/\b(cdmx|ciudad de mexico|df)\b/.test(t)) return "CDMX";
  if (/\b(morelos|cuernavaca|tequesquitengo)\b/.test(t)) return "Morelos";
  return null;
}

function validateAforoNumber(
  n: number,
  unidad: string | undefined,
  raw: string,
): AforoParseResult {
  const fragmento = raw.replace(/\s+/g, " ").trim();
  if (unidad && !AFORO_UNIDADES.test(unidad)) {
    return { ok: false, motivo: "unidad_invalida", fragmento };
  }
  if (!Number.isInteger(n) || n < 1 || n > 5000) {
    return { ok: false, motivo: "fuera_rango", fragmento };
  }
  return { ok: true, aforo: n };
}

export function formatFechaHumana(fecha: FechaTentativa | null): string | null {
  if (!fecha) return null;
  if (fecha.tipo === "dia" && fecha.fecha) {
    const [y, m, d] = fecha.fecha.split("-").map(Number);
    const mes = MESES_ES[(m ?? 0) - 1];
    if (!mes || !y || !d) return fecha.fecha;
    return `${d} de ${mes} de ${y}`;
  }
  if (fecha.tipo === "rango" && fecha.desde && fecha.hasta) {
    return `${fecha.desde} al ${fecha.hasta}`;
  }
  if (fecha.tipo === "mes" && fecha.mes && fecha.anio) {
    const mes = MESES_ES[fecha.mes - 1];
    if (!mes) return `${fecha.anio}`;
    return `${mes} de ${fecha.anio}`;
  }
  return null;
}
