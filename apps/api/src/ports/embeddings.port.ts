export interface EmbedOneRequest {
  text: string;
  model?: string;
}

export interface EmbedBatchRequest {
  texts: string[];
  model?: string;
}

export interface EmbeddingResult {
  embedding: number[];
  dimensions: number;
  model: string;
}

export interface EmbedBatchResult {
  embeddings: number[][];
  dimensions: number;
  model: string;
}

/**
 * Port de embeddings (indexación + query hybrid).
 * Implementación prod: OpenAI. CI: FakeEmbeddingsPort (vector por hash).
 */
export interface EmbeddingsPort {
  embedOne(request: EmbedOneRequest): Promise<EmbeddingResult>;
  embedBatch(request: EmbedBatchRequest): Promise<EmbedBatchResult>;
}
