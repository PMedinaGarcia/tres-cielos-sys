import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CohereClient } from "cohere-ai";
import type { RerankPort, RerankRequest, RerankResult } from "../ports/rerank.port";
import {
  ProviderRateLimitError,
  ProviderTimeoutError,
  ProviderUnavailableError,
} from "../ports/errors";

@Injectable()
export class CohereRerankAdapter implements RerankPort {
  private readonly client: CohereClient;
  private readonly defaultModel: string;
  private readonly threshold: number;
  private readonly timeoutMs: number;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>("ai.cohere.apiKey");
    if (!apiKey) {
      throw new ProviderUnavailableError("COHERE_API_KEY missing", "cohere");
    }
    this.client = new CohereClient({ token: apiKey });
    this.defaultModel =
      this.config.get<string>("ai.cohere.rerankModel") ?? "rerank-v3.5";
    this.threshold = this.config.get<number>("ai.rerank.threshold") ?? 0.85;
    this.timeoutMs = this.config.get<number>("ai.caps.requestTimeoutMs") ?? 45_000;
  }

  async rerank(request: RerankRequest): Promise<RerankResult> {
    try {
      const topN = request.topN ?? this.config.get<number>("ai.rerank.topN") ?? 15;
      const response = await this.client.v2.rerank({
        model: request.model ?? this.defaultModel,
        query: request.query,
        documents: request.passages.map((p) => p.text),
        topN: Math.min(topN, request.passages.length),
      });

      const hits = (response.results ?? []).map((r) => {
        const passage = request.passages[r.index];
        return {
          id: passage?.id ?? String(r.index),
          score: r.relevanceScore,
          index: r.index,
        };
      });

      return {
        hits,
        model: request.model ?? this.defaultModel,
        threshold: this.threshold,
      };
    } catch (err) {
      throw mapCohereError(err, this.timeoutMs);
    }
  }
}

function mapCohereError(err: unknown, timeoutMs: number): Error {
  const anyErr = err as { statusCode?: number; message?: string; status?: number };
  const message = anyErr?.message ?? "Cohere error";
  const status = anyErr?.statusCode ?? anyErr?.status;
  if (/timeout/i.test(message)) {
    return new ProviderTimeoutError(
      `Cohere timeout after ${timeoutMs}ms: ${message}`,
      "cohere",
      err,
    );
  }
  if (status === 429) {
    return new ProviderRateLimitError(message, "cohere", err);
  }
  return new ProviderUnavailableError(message, "cohere", err);
}
