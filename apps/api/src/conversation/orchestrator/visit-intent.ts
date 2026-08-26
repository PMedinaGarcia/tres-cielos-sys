/**
 * Intención de visita al jardín (no cita RAG ni horario de evento).
 */
import { normalizeProspectText } from "../text-normalize";

const VISITA_RE =
  /\b(visitar|visitas?|tour|recorrido|conocer (el )?(jardin|lugar|venue|salon|espacio)|ir a ver|agendar (una )?(cita|visita)|quiero (una )?visita|cita para visitar)\b/;

const HORARIO_EVENTO_RE =
  /\b(cierre|2:?00|02:?00|11 horas?|horario(s)? del evento|horario(s)? de (la )?locacion)\b/;

export function isIntencionVisita(texto: string): boolean {
  const n = normalizeProspectText(texto);
  if (!n) return false;
  if (HORARIO_EVENTO_RE.test(n) && !/\bvisitas?\b/.test(n)) return false;
  return VISITA_RE.test(n);
}
