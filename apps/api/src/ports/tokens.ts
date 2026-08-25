/** Tokens de inyección NestJS para ports de IA / storage. */

export const LLM_PORT = Symbol("LLM_PORT");
export const EMBEDDINGS_PORT = Symbol("EMBEDDINGS_PORT");
/** Alias histórico / docs 07 (`EmbeddingPort`). */
export const EMBEDDING_PORT = EMBEDDINGS_PORT;
export const RERANK_PORT = Symbol("RERANK_PORT");
export const VISION_PORT = Symbol("VISION_PORT");
export const TRANSCRIPTION_PORT = Symbol("TRANSCRIPTION_PORT");
export const OBJECT_STORAGE_PORT = Symbol("OBJECT_STORAGE_PORT");
