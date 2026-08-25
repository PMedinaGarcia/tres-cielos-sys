import type { RerankPort, RerankRequest, RerankResult } from "../rerank.port";
import { ProviderUnavailableError } from "../errors";
import { hashToUint32 } from "./hash";

const DEFAULT_MODEL = "fake-rerank";

/**
 * Fake: scores por id de pasaje (tabla) o score determinista por hash.
 * Default threshold 0.85 alineado a producto.
 */
export class FakeRerankPort implements RerankPort {
  private readonly scoreTable = new Map<string, number>();
  private failNext = false;
  readonly threshold: number;

  constructor(threshold = 0.85) {
    this.threshold = threshold;
  }

  /** Fija score [0,1] para un passage id. */
  setScore(passageId: string, score: number): void {
    this.scoreTable.set(passageId, clamp01(score));
  }

  simulateFailure(enabled = true): void {
    this.failNext = enabled;
  }

  async rerank(request: RerankRequest): Promise<RerankResult> {
    if (this.failNext) {
      this.failNext = false;
      throw new ProviderUnavailableError("Fake Cohere simulated failure", "fake-cohere");
    }

    const scored = request.passages.map((p, index) => {
      const fromTable = this.scoreTable.get(p.id);
      const score =
        fromTable ??
        clamp01(0.5 + (hashToUint32(`${request.query}|${p.id}`) % 5000) / 10000);
      return { id: p.id, score, index };
    });

    scored.sort((a, b) => b.score - a.score);
    const topN = request.topN ?? scored.length;
    return {
      hits: scored.slice(0, topN),
      model: request.model ?? DEFAULT_MODEL,
      threshold: this.threshold,
    };
  }
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}
