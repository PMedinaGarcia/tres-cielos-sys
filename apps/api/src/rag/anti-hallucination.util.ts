/** Gates anti-alucinación de montos en rama RAG. */

const MONTO_REGEX =
  /(?:\$\s?\d[\d.,]*|\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?\s*(?:mxn|usd|pesos)?|\b\d+\s*(?:mil|millones)\b)/gi;

export function textoContieneMontos(texto: string): boolean {
  return MONTO_REGEX.test(texto);
}

/** Elimina patrones de monto del texto (gate no_recuperable_precio / intent monetario). */
export function stripMontos(texto: string): string {
  return texto
    .replace(MONTO_REGEX, "[monto omitido — consulta catálogo]")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function detectIntencionMonetariaEnQuery(query: string): boolean {
  const q = query
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
  const cues = [
    "cuanto cuesta",
    "cuánto cuesta",
    "precio",
    "precios",
    "preico",
    "tarifa",
    "tarifas",
    "cotiza",
    "cotizar",
    "cotizacion",
    "presupuesto",
    "monto",
    "paquete esencial",
    "paquetes",
    "pakete",
    "sku",
  ];
  return cues.some((c) => q.includes(c.normalize("NFD").replace(/\p{M}/gu, "")));
}
