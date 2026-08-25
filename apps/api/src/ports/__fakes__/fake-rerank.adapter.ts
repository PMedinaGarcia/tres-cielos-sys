import type { RerankPort, RerankRequest, RerankResult } from "../rerank.port";
import { ProviderUnavailableError } from "../errors";
import { hashToUint32 } from "./hash";

/**
 * Alias usado por suites RAG (Fase D).
 * `scoreTable` como Record id → score.
 */
export class FakeRerankAdapter implements RerankPort {
  scoreTable: Record<string, number> = {};
  threshold = 0.85;
  failNext = false;

  async rerank(request: RerankRequest): Promise<RerankResult> {
    if (this.failNext) {
      this.failNext = false;
      throw new ProviderUnavailableError("Fake Cohere failure", "fake-cohere");
    }

    const scored = request.passages.map((p, index) => {
      const fromTable = this.scoreTable[p.id];
      const score =
        fromTable ??
        clamp01(0.5 + (hashToUint32(`${request.query}|${p.id}`) % 5000) / 10000);
      return { id: p.id, score, index };
    });
    scored.sort((a, b) => b.score - a.score);
    const topN = request.topN ?? scored.length;
    return {
      hits: scored.slice(0, topN),
      model: request.model ?? "fake-rerank",
      threshold: this.threshold,
    };
  }
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}
