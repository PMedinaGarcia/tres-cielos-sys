/**
 * Tipos del RagPipelineModule — alineados a 03-rag-avanzado, 05-dtos, database/03.
 *
 * Gap Prisma: `FragmentoVectorial` aún no existe en schema; estos tipos son el
 * contrato que Fase A debe materializar.
 */

export type TipoMaterial =
  | "pdf"
  | "word"
  | "foto"
  | "video"
  | "faq"
  | "xls"
  | "otro";

export type OrigenDerivacion =
  | "nativo"
  | "texto_nativo"
  | "vision"
  | "whisper"
  | "xls_narrativo";

export type PipelineEstado =
  | "pendiente"
  | "procesando"
  | "listo"
  | "error"
  | "fallido";

export type EstadoDocumento = "borrador" | "publicado" | "archivado";

export type OrigenRama = "vector" | "fts" | "ambos";

/** Motivos de handoff relevantes a la rama RAG (+ extensiones plan §5). */
export type MotivoHandoffRag =
  | "rerank_bajo"
  | "sin_cita_rag"
  | "proveedor_ia"
  | "sin_candidatos"
  | "intencion_monetaria"
  | "otro";

export type InventarioK = "K01" | "K02" | "K08" | "K09" | string;

export interface FragmentoRecuperable {
  id: string;
  texto: string;
  /** Embedding unitario; en prod = columna pgvector. */
  embedding: number[];
  activo: boolean;
  documentoEstado: EstadoDocumento;
  /** Espejo Asset/Documento — solo `listo` es recuperable. */
  pipelineEstado: PipelineEstado;
  /** null = alcance global. */
  sedeId: string | null;
  tipoMaterial: TipoMaterial;
  origenDerivacion: OrigenDerivacion;
  noRecuperablePrecio: boolean;
  nombreArchivoCita: string;
  inventarioId?: InventarioK;
}

export interface HybridCandidate {
  fragmento: FragmentoRecuperable;
  scoreHybrid: number;
  scoreVector?: number;
  scoreFts?: number;
  origenRama: OrigenRama;
}

export interface RerankedCandidate extends HybridCandidate {
  scoreRerank: number;
}

export interface CitaTipada {
  nombreArchivo: string;
  tipoMaterial: string;
  raw: string;
}

export interface RagAnswerContext {
  conversacionId?: string;
  mensajeId?: string;
  sedeId?: string | null;
  /**
   * Si el orquestador enruta por error una intención monetaria aquí,
   * no emitir montos; señalizar redirección a tools.
   */
  intencionMonetaria?: boolean;
  queryRewrite?: string | null;
  corpusIds?: string[];
  tiposDocumento?: string[];
}

export interface RagAnswerResult {
  ok: boolean;
  texto?: string;
  cita?: string;
  scores: number[];
  fragmentoIds: string[];
  motivoHandoff?: MotivoHandoffRag;
  registroRecuperacionId?: string;
  /** Gate: orquestador debe usar ToolsCatalog. */
  redirigirTools?: boolean;
}

export interface CandidatoRegistro {
  fragmentoId: string;
  scoreHybrid: number;
  origenRama: OrigenRama;
  scoreRerank: number | null;
  tipoMaterial: TipoMaterial;
  origenDerivacion: OrigenDerivacion;
  noRecuperablePrecio: boolean;
}

export interface FragmentoFinalRegistro {
  fragmentoId: string;
  scoreRerank: number;
  tipoMaterial: TipoMaterial;
  origenDerivacion: OrigenDerivacion;
  nombreArchivoCita: string;
  noRecuperablePrecio: boolean;
}

export interface RegistroRecuperacion {
  id: string;
  mensajeId?: string;
  conversacionId?: string;
  queryOriginal: string;
  queryRewrite: string | null;
  umbral: number;
  handoffPorBajaConfianza: boolean;
  handoffPorUmbral: boolean;
  motivoHandoff: MotivoHandoffRag | null;
  candidatos: CandidatoRegistro[];
  fragmentosFinales: FragmentoFinalRegistro[];
  tipoMaterial: TipoMaterial | null;
  origenDerivacion: OrigenDerivacion | null;
  fuentesCita: string[];
  respuestaTexto: string | null;
  cita: string | null;
  flags: {
    algunNoRecuperablePrecio: boolean;
    intencionMonetariaBloqueada: boolean;
    proveedorFallido: boolean;
    sinCita: boolean;
  };
  timestamp: string;
}

export const DEFAULT_RERANK_THRESHOLD = 0.85;
export const DEFAULT_HYBRID_TOP_N = 20;
export const DEFAULT_RERANK_TOP_K_LLM = 4;

export const CITA_REGEX =
  /\[Fuente:\s*(.+?)\s*\|\s*tipo:\s*([^\]]+?)\s*\]/i;

export const SAFE_COPY_K09 =
  "No tengo esa información en mi base de conocimiento autorizada. Te conecto con un asesor para ayudarte con precisión.";
