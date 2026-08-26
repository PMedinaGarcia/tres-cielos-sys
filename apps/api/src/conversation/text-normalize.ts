/** Normalización de texto de prospecto: acentos, mayúsculas y ruido. */

export function stripAccents(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeProspectText(texto: string): string {
  return stripAccents(texto)
    .toLowerCase()
    .replace(/[¿?¡!.,;:«»"'“”]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
