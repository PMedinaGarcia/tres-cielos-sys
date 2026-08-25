import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import type {
  EmbedBatchRequest,
  EmbedBatchResult,
  EmbeddingsPort,
  EmbedOneRequest,
  EmbeddingResult,
} from "../ports/embeddings.port";
import { DimensionMismatchError } from "../ports/errors";
import { mapOpenAiError } from "./openai.llm.adapter";

@Injectable()
export class OpenAiEmbeddingsAdapter implements EmbeddingsPort {
  private readonly client: OpenAI;
  private readonly defaultModel: string;
  private readonly expectedDimensions: number;
  private readonly timeoutMs: number;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>("ai.openai.apiKey");
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY missing for embeddings adapter");
    }
    this.timeoutMs = this.config.get<number>("ai.caps.requestTimeoutMs") ?? 45_000;
    this.client = new OpenAI({
      apiKey,
      baseURL: this.config.get<string>("ai.openai.baseUrl"),
      organization: this.config.get<string>("ai.openai.orgId"),
      project: this.config.get<string>("ai.openai.projectId"),
      timeout: this.timeoutMs,
      maxRetries: this.config.get<number>("ai.caps.maxRetries") ?? 2,
    });
    this.defaultModel =
      this.config.get<string>("ai.openai.embeddingModel") ?? "text-embedding-3-small";
    this.expectedDimensions =
      this.config.get<number>("ai.openai.embeddingDimensions") ?? 1536;
  }

  async embedOne(request: EmbedOneRequest): Promise<EmbeddingResult> {
    const batch = await this.embedBatch({
      texts: [request.text],
      model: request.model,
    });
    return {
      embedding: batch.embeddings[0]!,
      dimensions: batch.dimensions,
      model: batch.model,
    };
  }

  async embedBatch(request: EmbedBatchRequest): Promise<EmbedBatchResult> {
    try {
      const model = request.model ?? this.defaultModel;
      const response = await this.client.embeddings.create({
        model,
        input: request.texts,
        dimensions: this.expectedDimensions,
      });
      const embeddings = response.data
        .sort((a, b) => a.index - b.index)
        .map((d) => d.embedding);
      const dimensions = embeddings[0]?.length ?? 0;
      if (dimensions !== this.expectedDimensions) {
        throw new DimensionMismatchError(
          `Expected embedding dim ${this.expectedDimensions}, got ${dimensions}`,
          "openai",
        );
      }
      return { embeddings, dimensions, model: response.model };
    } catch (err) {
      if (err instanceof DimensionMismatchError) throw err;
      throw mapOpenAiError(err, this.timeoutMs);
    }
  }
}
