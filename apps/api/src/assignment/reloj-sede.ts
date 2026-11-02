const DIAS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export interface VentanaHorario {
  diaSemana: number;
  inicioMinutos: number;
  finMinutos: number;
}

/** Reloj civil de la sede. Sin filas de horario, el asesor sigue elegible. */
export function dentroDeHorario(
  ventanas: VentanaHorario[],
  now: Date,
  timeZone: string,
): boolean {
  if (ventanas.length === 0) return true;
  const reloj = relojEnZona(now, timeZone);
  return ventanas.some(
    (v) =>
      v.diaSemana === reloj.dia &&
      reloj.minutos >= v.inicioMinutos &&
      reloj.minutos < v.finMinutos,
  );
}

export function relojEnZona(
  now: Date,
  timeZone: string,
): { dia: number; minutos: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  let hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  if (hour === 24) hour = 0;
  const dia = Math.max(0, DIAS.indexOf(weekday as (typeof DIAS)[number]));
  return { dia, minutos: hour * 60 + minute };
}

/** Inicio del día civil de la sede, en instante UTC. */
export function inicioDelDia(timeZone: string, now = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (tipo: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === tipo)?.value);
  let hour = get("hour");
  if (hour === 24) hour = 0;
  const asIfUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    hour,
    get("minute"),
    get("second"),
  );
  const offset = asIfUtc - now.getTime();
  return new Date(Date.UTC(get("year"), get("month") - 1, get("day"), 0, 0, 0) - offset);
}
