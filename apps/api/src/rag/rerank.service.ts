import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { isProviderError } from "../ports/errors";
import type { RerankPort } from "../ports/rerank.port";
import { RERANK_PORT } from "../ports/tokens";
import {
  DEFAULT_RERANK_THRESHOLD,
  DEFAULT_RERANK_TOP_K_LLM,
  HybridCandidate,
  RerankedCandidate,
} from "./types";

export class RerankProviderError extends Error {
  readonly code = "RERANK_PROVIDER_ERROR" as const;
  readonly motivoHandoff = "proveedor_ia" as const;

  constructor(cause?: unknown) {
    const msg =
      cause instanceof Error
        ? cause.message
        : "Fallo en RerankPort (Cohere)";
    super(msg);
    this.name = "RerankProviderError";
  }
}

export interface RerankPassResult {
  umbral: number;
  ranked: RerankedCandidate[];
  aboveThreshold: RerankedCandidate[];
  maxScore: number;
  pasaUmbral: boolean;
}

/**
 * D2 — Rerank + umbral configurable (default 0.85).
 * NUNCA bypass al LLM con hybrid crudo si Cohere cae → RerankProviderError.
 */
@Injectable()
export class RerankService {
  constructor(
    @Inject(RERANK_PORT) private readonly rerankPort: RerankPort,
    private readonly config: ConfigService,
  ) {}

  getUmbral(): number {
    const fromConfig =
      this.config.get<number>("ai.rerank.threshold") ??
      Number(
        this.config.get<string>("RERANK_THRESHOLD") ?? DEFAULT_RERANK_THRESHOLD,
      );
    const n = Number(fromConfig);
    return Number.isFinite(n) ? n : DEFAULT_RERANK_THRESHOLD;
  }

  getTopKLlm(): number {
    const fromConfig =
      this.config.get<number>("ai.rerank.topKLlm") ??
      Number(
        this.config.get<string>("RERANK_TOP_K_LLM") ?? DEFAULT_RERANK_TOP_K_LLM,
      );
    const n = Number(fromConfig);
    if (!Number.isFinite(n)) return DEFAULT_RERANK_TOP_K_LLM;
    return Math.min(4, Math.max(3, Math.floor(n)));
  }

  async rerankAndGate(
    query: string,
    candidates: HybridCandidate[],
  ): Promise<RerankPassResult> {
    const umbral = this.getUmbral();
    if (candidates.length === 0) {
      return {
        umbral,
        ranked: [],
        aboveThreshold: [],
        maxScore: 0,
        pasaUmbral: false,
      };
    }

    let hits: Array<{ id: string; score: number }>;
    try {
      const result = await this.rerankPort.rerank({
        query,
        passages: candidates.map((c) => ({
          id: c.fragmento.id,
          text: c.fragmento.texto,
        })),
      });
      hits = result.hits;
    } catch (err) {
      if (isProviderError(err) || err instanceof Error) {
        throw new RerankProviderError(err);
      }
      throw new RerankProviderError(err);
    }

    const scoreById = new Map(hits.map((s) => [s.id, s.score]));
    const ranked: RerankedCandidate[] = candidates
      .map((c) => ({
        ...c,
        scoreRerank: scoreById.get(c.fragmento.id) ?? 0,
      }))
      .sort((a, b) => b.scoreRerank - a.scoreRerank);

    const aboveThreshold = ranked
      .filter((c) => c.scoreRerank >= umbral)
      .slice(0, this.getTopKLlm());

    const maxScore = ranked[0]?.scoreRerank ?? 0;

    return {
      umbral,
      ranked,
      aboveThreshold,
      maxScore,
      pasaUmbral: aboveThreshold.length > 0,
    };
  }
}
