/**
 * Pregunta de ubicación / cómo llegar (ficha de sede), no visita ni horario de evento.
 */
import { normalizeProspectText } from "../text-normalize";

const LOCATION_RE =
  /\b(ubicacion|ubicad[oa]s?|como llegar|como llego|direccion|maps|waze|\bgps\b|\bpin\b)\b/;

const DONDE_RE =
  /\b(en )?donde (es|queda|quedan|estan|esta|ubican|se ubica|se encuentra[n]?|encuentran|encuentro)\b/;

const LUGAR_RE =
  /\b(en que (parte|zona|lugar)|a donde (quedo|voy|llego)|donde queda[n]?)\b/;

const TEQUES_LUGAR_RE =
  /\b(donde|direccion|ubica|llegar|llego|maps|waze|gps).{0,48}tequesquitengo\b|\btequesquitengo.{0,48}(donde|direccion|ubica|llegar|llego|maps|waze)\b/;

export function isLocationQuery(texto: string): boolean {
  const n = normalizeProspectText(texto);
  if (!n) return false;
  return (
    LOCATION_RE.test(n) ||
    DONDE_RE.test(n) ||
    LUGAR_RE.test(n) ||
    TEQUES_LUGAR_RE.test(n)
  );
}
