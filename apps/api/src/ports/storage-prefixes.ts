/** Prefijos de object storage (S3). Binarios nunca en Postgres. */
export const STORAGE_PREFIXES = {
  conocimiento: "conocimiento",
  adjuntoCanal: "adjunto_canal",
  guion: "guion",
  catalogo: "catalogo",
} as const;

export const STORAGE_KEYS = {
  guionPaqueteBodas: `${STORAGE_PREFIXES.guion}/paquete-bodas-2027.pdf`,
} as const;

export const GUION_SIGNED_URL_TTL_SEC = 60 * 60;
