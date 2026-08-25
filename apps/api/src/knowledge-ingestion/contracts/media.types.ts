export type TipoMaterial =
  | "pdf"
  | "docx"
  | "xlsx"
  | "csv"
  | "imagen"
  | "video";

export type PipelineEstado =
  | "recibido"
  | "en_cola"
  | "extrayendo"
  | "scrub"
  | "indexando"
  | "listo"
  | "error"
  | "rechazado";

export type OrigenMedia = "biblioteca_k" | "adjunto_canal";

export type PropositoAsset =
  | "conocimiento"
  | "import_catalogo"
  | "adjunto_canal";

export type MotivoHandoffMedia =
  | "adjunto_no_soportado"
  | "material_ocr_tarifas"
  | "proveedor_ia"
  | "cupo_ia"
  | "archivo_demasiado_grande"
  | "video_excede_duracion"
  | "storage_put_failed";

export interface ParsedFragment {
  texto: string;
  noRecuperablePrecio: boolean;
  tipoMaterial: TipoMaterial;
  origenDerivacion:
    | "texto_nativo"
    | "vision"
    | "whisper"
    | "xls_narrativo";
  orden: number;
}

export interface MediaRouteResult {
  ok: boolean;
  pipelineEstado: PipelineEstado;
  storageKey?: string;
  fragments: ParsedFragment[];
  publicaAK: boolean;
  motivoRechazo?: MotivoHandoffMedia | string;
  slaMs?: number;
  catalogoSnapshot?: unknown;
  errorTipificado?: MotivoHandoffMedia | string;
}

export const MIME_ALLOWLIST: Record<string, TipoMaterial> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "application/msword": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-excel": "xlsx",
  "text/csv": "csv",
  "image/jpeg": "imagen",
  "image/png": "imagen",
  "image/webp": "imagen",
  "video/mp4": "video",
  "video/quicktime": "video",
};

export const MEDIA_LIMITS = {
  pdfWordMb: 25,
  excelMb: 15,
  fotoMb: 10,
  videoMb: 100,
  videoMaxMs: 5 * 60 * 1000,
} as const;

export const SLA_MS = {
  texto: 60_000,
  foto: 90_000,
  video: 5 * 60_000,
} as const;
