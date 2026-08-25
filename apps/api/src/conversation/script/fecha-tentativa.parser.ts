import * as chrono from "chrono-node";
import type { FechaTentativa, PasoGuion } from "../types";

export const TZ_MEXICO = "America/Mexico_City";

export interface ParseFechaOptions {
  now?: Date;
  paso?: PasoGuion;
}

const MES_NOMBRE: Record<string, number> = {
  enero: 1,
  ene: 1,
  febrero: 2,
  feb: 2,
  marzo: 3,
  mar: 3,
  abril: 4,
  abr: 4,
  mayo: 5,
  may: 5,
  junio: 6,
  jun: 6,
  julio: 7,
  jul: 7,
  agosto: 8,
  ago: 8,
  septiembre: 9,
  setiembre: 9,
  sep: 9,
  sept: 9,
  octubre: 10,
  oct: 10,
  noviembre: 11,
  nov: 11,
  diciembre: 12,
  dic: 12,
};

const MES_ALT = Object.keys(MES_NOMBRE).sort((a, b) => b.length - a.length).join("|");

const DOW: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function toIsoDate(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

export function ymdToUtcDate(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d));
}

export function isValidCalendarDate(y: number, m: number, d: number): boolean {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) {
    return false;
  }
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = ymdToUtcDate(y, m, d);
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function todayPartsMexico(now = new Date()): {
  y: number;
  m: number;
  d: number;
  iso: string;
} {
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ_MEXICO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d, iso };
}

/** Fechas estrictamente anteriores a hoy−1 (CDMX) se rechazan. */
export function isBeforeMinAllowed(iso: string, now = new Date()): boolean {
  const today = todayPartsMexico(now);
  const min = ymdToUtcDate(today.y, today.m, today.d);
  min.setUTCDate(min.getUTCDate() - 1);
  const [y, m, d] = iso.split("-").map(Number);
  if (!isValidCalendarDate(y, m, d)) return true;
  return ymdToUtcDate(y, m, d) < min;
}

function isPastMonth(anio: number, mes: number, now: Date): boolean {
  const today = todayPartsMexico(now);
  return anio < today.y || (anio === today.y && mes < today.m);
}

export function isFlexibleFecha(texto: string): boolean {
  return /flexib|aprox|m[aá]s o menos|masomenos|por ah[ií]|alrededor|cerca de|casi/i.test(
    texto,
  );
}

function stripAccents(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeFechaText(texto: string): string {
  return stripAccents(texto)
    .toLowerCase()
    .replace(/pa'?l\b/g, "para el")
    .replace(/\bmasomenos\b/g, "mas o menos")
    .replace(/\s+/g, " ")
    .trim();
}

function diaResult(
  y: number,
  m: number,
  d: number,
  flexible: boolean,
  now: Date,
): FechaTentativa | null {
  if (!isValidCalendarDate(y, m, d)) return null;
  const fecha = toIsoDate(y, m, d);
  if (isBeforeMinAllowed(fecha, now)) return null;
  return { tipo: "dia", fecha, flexible };
}

function mesResult(
  anio: number,
  mes: number,
  flexible: boolean,
  now: Date,
): FechaTentativa | null {
  if (mes < 1 || mes > 12) return null;
  if (isPastMonth(anio, mes, now)) return null;
  return { tipo: "mes", mes, anio, flexible: true };
}

function nextWeekday(targetDow: number, now: Date): FechaTentativa | null {
  const t = todayPartsMexico(now);
  const current = ymdToUtcDate(t.y, t.m, t.d);
  const currentDow = current.getUTCDay();
  let delta = (targetDow - currentDow + 7) % 7;
  if (delta === 0) delta = 7;
  current.setUTCDate(current.getUTCDate() + delta);
  return diaResult(
    current.getUTCFullYear(),
    current.getUTCMonth() + 1,
    current.getUTCDate(),
    false,
    now,
  );
}

function addDays(now: Date, days: number): FechaTentativa | null {
  const t = todayPartsMexico(now);
  const dt = ymdToUtcDate(t.y, t.m, t.d);
  dt.setUTCDate(dt.getUTCDate() + days);
  return diaResult(
    dt.getUTCFullYear(),
    dt.getUTCMonth() + 1,
    dt.getUTCDate(),
    false,
    now,
  );
}

function parseIso(norm: string, flexible: boolean, now: Date): FechaTentativa | null {
  const iso = norm.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (!iso) return null;
  return diaResult(Number(iso[1]), Number(iso[2]), Number(iso[3]), flexible, now);
}

function parseNumericFull(
  norm: string,
  flexible: boolean,
  now: Date,
): FechaTentativa | null {
  const full = norm.match(/\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\b/);
  if (!full) return null;
  const d = Number(full[1]);
  const m = Number(full[2]);
  let y = Number(full[3]);
  if (y < 100) y += 2000;
  return diaResult(y, m, d, flexible, now);
}

function isNumericShortSinAnio(norm: string): boolean {
  if (/\b\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}\b/.test(norm)) return false;
  return /\b\d{1,2}[/\-.]\d{1,2}\b/.test(norm);
}

function parseDayOfMonthEs(
  norm: string,
  flexible: boolean,
  now: Date,
): FechaTentativa | null {
  const re = new RegExp(
    `\\b(\\d{1,2})\\s+de\\s+(${MES_ALT})\\s+(?:de\\s+)?(20\\d{2})\\b`,
  );
  const m = norm.match(re);
  if (!m) return null;
  const dia = Number(m[1]);
  const mes = MES_NOMBRE[m[2]];
  if (!mes) return null;
  return diaResult(Number(m[3]), mes, dia, flexible, now);
}

function isDayOfMonthEsSinAnio(norm: string): boolean {
  const withYear = new RegExp(
    `\\b\\d{1,2}\\s+de\\s+(${MES_ALT})\\s+(?:de\\s+)?20\\d{2}\\b`,
  );
  const any = new RegExp(`\\b\\d{1,2}\\s+de\\s+(${MES_ALT})\\b`);
  return any.test(norm) && !withYear.test(norm);
}

function parseMonthYear(
  norm: string,
  now: Date,
): FechaTentativa | null {
  const re = new RegExp(`\\b(${MES_ALT})\\s+(?:del?\\s+)?(20\\d{2})\\b`);
  const m = norm.match(re);
  if (!m) return null;
  const mes = MES_NOMBRE[m[1]];
  return mesResult(Number(m[2]), mes, true, now);
}

function isBareMonthSinAnio(norm: string): boolean {
  if (/\b20\d{2}\b/.test(norm)) return false;
  const re = new RegExp(`\\b(?:en\\s+)?(${MES_ALT})\\b`);
  return re.test(norm);
}

function parseRange(
  norm: string,
  flexible: boolean,
  now: Date,
): FechaTentativa | null {
  const re = new RegExp(
    `\\bdel?\\s+(\\d{1,2})\\s+al\\s+(\\d{1,2})\\s+de\\s+(${MES_ALT})\\s+(?:de\\s+)?(20\\d{2})\\b`,
  );
  const m = norm.match(re);
  if (!m) return null;
  const d1 = Number(m[1]);
  const d2 = Number(m[2]);
  const mes = MES_NOMBRE[m[3]];
  const yHint = Number(m[4]);
  if (!mes) return null;
  const a = diaResult(yHint, mes, d1, flexible, now);
  const b = diaResult(yHint, mes, d2, flexible, now);
  if (!a?.fecha || !b?.fecha) return null;
  return { tipo: "rango", desde: a.fecha, hasta: b.fecha, flexible };
}

function isRangeSinAnio(norm: string): boolean {
  const withYear = new RegExp(
    `\\bdel?\\s+\\d{1,2}\\s+al\\s+\\d{1,2}\\s+de\\s+(${MES_ALT})\\s+(?:de\\s+)?20\\d{2}\\b`,
  );
  const any = new RegExp(
    `\\bdel?\\s+\\d{1,2}\\s+al\\s+\\d{1,2}\\s+de\\s+(${MES_ALT})\\b`,
  );
  return any.test(norm) && !withYear.test(norm);
}

function parseRelativeWords(norm: string, now: Date): FechaTentativa | null {
  if (/\bhoy\b/.test(norm)) return addDays(now, 0);
  if (/\bpasado\s+manana\b/.test(norm)) {
    return addDays(now, 2);
  }
  if (/\bmanana\b/.test(norm)) return addDays(now, 1);
  return null;
}

function parseWeekday(norm: string, now: Date): FechaTentativa | null {
  if (!/(viene|proximo|siguiente)/.test(norm) && !/\bel\s+(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/.test(norm)) {
    return null;
  }
  for (const [name, dow] of Object.entries(DOW)) {
    if (new RegExp(`\\b${name}\\b`).test(norm)) {
      return nextWeekday(dow, now);
    }
  }
  return null;
}

function isBareDaySinAnio(norm: string, paso: PasoGuion | undefined): boolean {
  if (paso && paso !== "fecha") return false;
  if (paso === "fecha" && /\bel quince\b/.test(norm) && !/anos|anios|xv/.test(norm)) {
    return true;
  }
  return Boolean(norm.match(/\b(?:para el|el|dia|para)\s+(\d{1,2})\b/));
}

export function tieneAnioExplicito(texto: string): boolean {
  const norm = normalizeFechaText(texto);
  return (
    /\b20\d{2}\b/.test(norm) ||
    /\b\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}\b/.test(norm)
  );
}

function parseChrono(original: string, now: Date, flexible: boolean): FechaTentativa | null {
  const t = todayPartsMexico(now);
  const ref = new Date(Date.UTC(t.y, t.m - 1, t.d, 18, 0, 0));
  const results = chrono.es.parse(original, ref, { forwardDate: true });
  if (results.length === 0) return null;
  const hit = results[0];
  const start = hit.start.date();
  const y = start.getUTCFullYear();
  const m = start.getUTCMonth() + 1;
  const d = start.getUTCDate();

  if (hit.end) {
    const end = hit.end.date();
    const a = diaResult(y, m, d, flexible, now);
    const b = diaResult(
      end.getUTCFullYear(),
      end.getUTCMonth() + 1,
      end.getUTCDate(),
      flexible,
      now,
    );
    if (a?.fecha && b?.fecha) {
      return { tipo: "rango", desde: a.fecha, hasta: b.fecha, flexible };
    }
  }

  const knownDay = hit.start.isCertain("day");
  const knownMonth = hit.start.isCertain("month");
  if (knownMonth && !knownDay) {
    return mesResult(y, m, true, now);
  }
  return diaResult(y, m, d, flexible, now);
}

function calendarLooksMissingYear(
  norm: string,
  paso: PasoGuion | undefined,
): boolean {
  return (
    isDayOfMonthEsSinAnio(norm) ||
    isNumericShortSinAnio(norm) ||
    isRangeSinAnio(norm) ||
    isBareMonthSinAnio(norm) ||
    isBareDaySinAnio(norm, paso)
  );
}

function asFechaResult(
  fecha: FechaTentativa | null,
  now: Date,
  flexible: boolean,
): FechaParseResult {
  if (!fecha) return { ok: false, motivo: "no_interpretada" };
  const hit = { ...fecha, flexible: fecha.flexible || flexible };
  if (hit.tipo === "dia" && hit.fecha && isBeforeMinAllowed(hit.fecha, now)) {
    return { ok: false, motivo: "pasada" };
  }
  if (hit.tipo === "rango" && hit.desde && isBeforeMinAllowed(hit.desde, now)) {
    return { ok: false, motivo: "pasada" };
  }
  if (
    hit.tipo === "mes" &&
    hit.anio != null &&
    hit.mes != null &&
    isPastMonth(hit.anio, hit.mes, now)
  ) {
    return { ok: false, motivo: "pasada" };
  }
  return { ok: true, fecha: hit };
}

export type FechaParseMotivo = "sin_anio" | "no_interpretada" | "pasada";

export type FechaParseResult =
  | { ok: true; fecha: FechaTentativa }
  | { ok: false; motivo: FechaParseMotivo };

/**
 * Parser de fechas en español MX (ISO, numérico DMY, coloquial, relativos).
 * Fechas de calendario (día+mes, 15/03, rangos, mes suelto) exigen año explícito.
 * Relativos (`hoy`, `mañana`, `el sábado que viene`) sí se resuelven sin año en el texto.
 */
export function explainFechaTentativa(
  texto: string,
  options: ParseFechaOptions = {},
): FechaParseResult {
  const now = options.now ?? new Date();
  const flexible = isFlexibleFecha(texto);
  const norm = normalizeFechaText(texto);
  if (!norm) return { ok: false, motivo: "no_interpretada" };

  if (/\b20\d{2}-\d{2}-\d{2}\b/.test(norm)) {
    return asFechaResult(parseIso(norm, flexible, now), now, flexible);
  }
  if (/\b\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}\b/.test(norm)) {
    return asFechaResult(parseNumericFull(norm, flexible, now), now, flexible);
  }

  const ranged = parseRange(norm, flexible, now);
  if (ranged) return asFechaResult(ranged, now, flexible);

  if (
    new RegExp(
      `\\b\\d{1,2}\\s+de\\s+(${MES_ALT})\\s+(?:de\\s+)?20\\d{2}\\b`,
    ).test(norm)
  ) {
    return asFechaResult(parseDayOfMonthEs(norm, flexible, now), now, flexible);
  }

  const withYear: Array<() => FechaTentativa | null> = [
    () => parseMonthYear(norm, now),
    () => parseRelativeWords(norm, now),
    () => parseWeekday(norm, now),
  ];
  for (const step of withYear) {
    const hit = step();
    if (hit) return asFechaResult(hit, now, flexible);
  }

  if (calendarLooksMissingYear(norm, options.paso)) {
    return { ok: false, motivo: "sin_anio" };
  }

  if (tieneAnioExplicito(norm)) {
    return asFechaResult(parseChrono(texto, now, flexible), now, flexible);
  }

  return { ok: false, motivo: "no_interpretada" };
}

export function parseFechaTentativa(
  texto: string,
  options: ParseFechaOptions = {},
): FechaTentativa | null {
  const result = explainFechaTentativa(texto, options);
  return result.ok ? result.fecha : null;
}

export function fechaTentativaToIso(
  fecha?: FechaTentativa | null,
): string | undefined {
  if (!fecha) return undefined;
  if (fecha.tipo === "dia" && fecha.fecha) return fecha.fecha;
  if (fecha.tipo === "rango" && fecha.desde) return fecha.desde;
  if (fecha.tipo === "mes" && fecha.anio && fecha.mes) {
    return toIsoDate(fecha.anio, fecha.mes, 1);
  }
  return undefined;
}
