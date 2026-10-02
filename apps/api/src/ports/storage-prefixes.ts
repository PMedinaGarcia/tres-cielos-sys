/** Prefijos de object storage (S3). Binarios nunca en Postgres. */
export const STORAGE_PREFIXES = {
  conocimiento: "conocimiento",
  adjuntoCanal: "adjunto_canal",
  guion: "guion",
  catalogo: "catalogo",
} as const;

export function guionPdfStorageKey(slug: string): string {
  return `${STORAGE_PREFIXES.guion}/${slug}.pdf`;
}

export const STORAGE_KEYS = {
  guionExperienciaBoda: guionPdfStorageKey("experiencia-boda-tres-dias-2027"),
  guionTarifas2027: guionPdfStorageKey("tarifas-2027-tres-cielos"),
} as const;

export const GUION_SIGNED_URL_TTL_SEC = 60 * 60;
