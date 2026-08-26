/**
 * Intención monetaria / catálogo (precio, paquete, cotización).
 * Incluye plurales y typos frecuentes del prospecto.
 */

export const DATOS_DUROS_RE =
  /\b(?:precios?|preicos?|precion|presios?|cuesta|custa|cu[aá]ntos?|kuanto|costos?|cotiz\w*|cotizaci[oó]n|paquetes?|paketes?|sku|inclusi[oó]n(?:es)?|incluye|que\s+trae|que\s+tiene|detalle|ficha|compar(?:a|ar)\s+paquet\w*|anticipo\s+m[ií]nimo|tarifas?)\b/i;

export const MONTO_RIESGO_RE =
  /\b(?:\$\s*\d|\d+\s*(?:mxn|pesos)|cu[aá]ntos?|precios?|preicos?|precion|tarifas?|costos?)\b/i;

export function isIntencionMonetaria(texto: string): boolean {
  return DATOS_DUROS_RE.test(texto) || MONTO_RIESGO_RE.test(texto);
}
