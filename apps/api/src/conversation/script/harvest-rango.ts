import { stripAccents } from "../text-normalize";
import { PISO_INVERSION_MXN } from "../conversation-flow";
import type {
  CamposCapturados,
  EncajeEconomico,
  IntencionNivel,
  RangoInversion,
} from "../types";

export const INVERSION_R250_PAYLOAD = "inversion.r250_349";
export const INVERSION_R350_PAYLOAD = "inversion.r350_499";
export const INVERSION_R500_PAYLOAD = "inversion.r500_mas";
export const INVERSION_POR_DEFINIR_PAYLOAD = "inversion.por_definir";
export const ACLARACION_SI_PAYLOAD = "aclaracion.si";
export const ACLARACION_NO_PAYLOAD = "aclaracion.no";

const RANGO_POR_PAYLOAD: Record<string, RangoInversion> = {
  [INVERSION_R250_PAYLOAD]: "r250_349",
  [INVERSION_R350_PAYLOAD]: "r350_499",
  [INVERSION_R500_PAYLOAD]: "r500_mas",
  [INVERSION_POR_DEFINIR_PAYLOAD]: "por_definir",
};

export interface RangoParseResult {
  rango?: RangoInversion;
  encaje?: EncajeEconomico;
  monto?: number;
}

export function parseRangoInversion(texto: string): RangoParseResult | null {
  const raw = texto.trim();
  if (!raw) return null;
  const fromPayload = RANGO_POR_PAYLOAD[raw];
  if (fromPayload) {
    return fromPayload === "por_definir"
      ? { rango: "por_definir", encaje: "no_confirmado" }
      : { rango: fromPayload, encaje: "confirmado" };
  }

  const t = stripAccents(raw.toLowerCase());
  if (
    /aun por definir|por definir|aun lo estan definiendo|lo estan definiendo|no se|no se a[uú]n|indefinid|no tengo (claro|definido)|no estoy seguro/.test(
      t,
    )
  ) {
    return { rango: "por_definir", encaje: "no_confirmado" };
  }

  if (
    /500\s*(mil)?\s*(o mas|en adelante)|mas de\s*500|arriba de\s*500|m[aá]s de quinientos/.test(
      t,
    )
  ) {
    return { rango: "r500_mas", encaje: "confirmado" };
  }
  if (/350\s*[–\-a]\s*499|350\s*a\s*499|350\s*-\s*499/.test(t)) {
    return { rango: "r350_499", encaje: "confirmado" };
  }
  if (/250\s*[–\-a]\s*349|250\s*a\s*349|250\s*-\s*349/.test(t)) {
    return { rango: "r250_349", encaje: "confirmado" };
  }

  const monto = parseMontoMxn(t);
  if (monto == null) return null;
  if (monto < PISO_INVERSION_MXN) {
    return { rango: "menor_250", encaje: "no", monto };
  }
  if (isCifraAmbiguaCercaPiso(t, monto)) {
    return { rango: "por_definir", encaje: "no_confirmado", monto };
  }
  return { rango: rangoFromMonto(monto), encaje: "confirmado", monto };
}

/** Hedging cerca del piso: gasta la aclaración B3 en vez de confirmar el rango. */
function isCifraAmbiguaCercaPiso(texto: string, monto: number): boolean {
  if (monto < PISO_INVERSION_MXN || monto >= 350_000) return false;
  return /alrededor|mas o menos|aproximadamente|\baprox\b|cerca de|como unos/.test(
    texto,
  );
}

export function rangoFromMonto(monto: number): RangoInversion {
  if (monto >= 500_000) return "r500_mas";
  if (monto >= 350_000) return "r350_499";
  return "r250_349";
}

export function parseMontoMxn(texto: string): number | null {
  const t = stripAccents(texto.toLowerCase());
  if (
    !/\$|mxn|pesos|presupuesto|inversion|inversión|mil\b|\bk\b/.test(t) &&
    !/\d{1,3}(?:[,\s]\d{3}){2,}/.test(t)
  ) {
    return null;
  }
  const millon = t.match(/(\d+(?:[.,]\d+)?)\s*millones?/);
  if (millon) {
    const n = Number(millon[1].replace(",", "."));
    if (Number.isFinite(n)) return Math.round(n * 1_000_000);
  }
  const mil = t.match(/(\d+(?:[.,]\d+)?)\s*mil\b/);
  if (mil) {
    const n = Number(mil[1].replace(",", "."));
    if (Number.isFinite(n)) return Math.round(n * 1000);
  }
  const k = t.match(/(\d+(?:[.,]\d+)?)\s*k\b/);
  if (k) {
    const n = Number(k[1].replace(",", "."));
    if (Number.isFinite(n)) return Math.round(n * 1000);
  }
  const plain = t.match(/\$?\s*(\d{1,3}(?:[,\s]\d{3})+|\d{5,7})/);
  if (plain) {
    const n = Number(plain[1].replace(/[,\s]/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function parseIntencionNivel(texto: string): IntencionNivel | null {
  const t = stripAccents(texto.toLowerCase());
  if (
    /\b(cotiz|reserv|apart|visita|disponib|agend)/.test(t)
  ) {
    return "alta";
  }
  if (/\b(compar|diferenc|opciones|ver paquetes)\b/.test(t)) return "media";
  if (
    /\b(solo (info|informacion)|nada mas pregunt|informacion general|estoy viendo)\b/.test(
      t,
    )
  ) {
    return "baja";
  }
  return null;
}

export function parseAceptaPiso(texto: string): boolean | null {
  const raw = texto.trim();
  if (raw === ACLARACION_SI_PAYLOAD) return true;
  if (raw === ACLARACION_NO_PAYLOAD) return false;
  const t = stripAccents(raw.toLowerCase());
  if (
    /^(si|sip|ok|va|dale|yes|sale|claro|obvio|por supuesto)\b/.test(t) ||
    /\b(c[oó]modos|comodos|s[ií] se\b|acepto|de acuerdo|adelante)\b/.test(t) ||
    /\b(lo consideramos|podemos considerarlo)\b/.test(t)
  ) {
    return true;
  }
  if (
    /^(no|nel|nop)\b/.test(t) ||
    /\bno (podemos|alcanza|llegamos|estamos)\b/.test(t) ||
    /\bbuscamos algo menor|algo menor\b/.test(t)
  ) {
    return false;
  }
  return null;
}

export function applyRangoHarvest(
  texto: string,
  campos: CamposCapturados,
): Partial<CamposCapturados> {
  const parsed = parseRangoInversion(texto);
  if (!parsed) return {};
  const patch: Partial<CamposCapturados> = {};
  if (parsed.rango && !campos.rangoInversion) patch.rangoInversion = parsed.rango;
  if (parsed.encaje && !campos.encajeEconomico) {
    patch.encajeEconomico = parsed.encaje;
  }
  if (parsed.encaje === "no" || parsed.rango === "menor_250") {
    patch.encajeEconomico = "no";
    patch.rangoInversion = "menor_250";
    return patch;
  }
  if (parsed.rango && parsed.rango !== "por_definir") {
    patch.rangoInversion = parsed.rango;
    patch.encajeEconomico = "confirmado";
  }
  return patch;
}
