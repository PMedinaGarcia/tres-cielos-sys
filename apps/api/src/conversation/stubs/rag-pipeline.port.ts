export const RAG_PIPELINE_PORT = "RAG_PIPELINE_PORT";

export interface RagPipelineResult {
  ok: boolean;
  texto?: string;
  motivoFallo?:
    | "no_implementado"
    | "rerank_bajo"
    | "sin_cita_rag"
    | "proveedor_ia"
    | "sin_fragmentos";
  scoresRerank?: number[];
  fragmentoIds?: string[];
  registroRecuperacionId?: string;
  cita?: string;
  umbral?: number;
  redirigirTools?: boolean;
}

export interface RagPipelinePort {
  answer(input: {
    query: string;
    conversacionId: string;
    mensajeId?: string;
    sedeId?: string | null;
    corpusIds?: string[];
    tiposDocumento?: string[];
  }): Promise<RagPipelineResult>;
}
