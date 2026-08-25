import type {
  EmbedBatchRequest,
  EmbedBatchResult,
  EmbeddingsPort,
  EmbedOneRequest,
  EmbeddingResult,
} from "../embeddings.port";
import { ProviderUnavailableError } from "../errors";
import { hashToEmbedding } from "./hash";

export const FAKE_EMBEDDING_DIMENSIONS = 1536;
const DEFAULT_MODEL = "fake-embedding";

/**
 * Fake determinista: vector unitario derivado de hash del texto.
 */
export class FakeEmbeddingsPort implements EmbeddingsPort {
  private failNext = false;
  readonly dimensions: number;

  constructor(dimensions = FAKE_EMBEDDING_DIMENSIONS) {
    this.dimensions = dimensions;
  }

  simulateFailure(enabled = true): void {
    this.failNext = enabled;
  }

  async embedOne(request: EmbedOneRequest): Promise<EmbeddingResult> {
    this.throwIfSimulated();
    return {
      embedding: hashToEmbedding(request.text, this.dimensions),
      dimensions: this.dimensions,
      model: request.model ?? DEFAULT_MODEL,
    };
  }

  async embedBatch(request: EmbedBatchRequest): Promise<EmbedBatchResult> {
    this.throwIfSimulated();
    return {
      embeddings: request.texts.map((t) => hashToEmbedding(t, this.dimensions)),
      dimensions: this.dimensions,
      model: request.model ?? DEFAULT_MODEL,
    };
  }

  private throwIfSimulated(): void {
    if (this.failNext) {
      this.failNext = false;
      throw new ProviderUnavailableError("Fake embeddings simulated failure", "fake-embeddings");
    }
  }
}
