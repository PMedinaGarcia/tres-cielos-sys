import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { EmbeddingsPort } from "../ports/embeddings.port";
import { EMBEDDINGS_PORT } from "../ports/tokens";
import { FragmentRepository } from "./fragment.repository";
import { FRAGMENT_REPOSITORY } from "./tokens";
import { DEFAULT_HYBRID_TOP_N, HybridCandidate } from "./types";
import { fuseAndDedupe } from "./hybrid-search.util";

export {
  cosineSimilarity,
  tokenizeSpanish,
  ftsRank,
  fuseAndDedupe,
} from "./hybrid-search.util";

/**
 * Hybrid search: rama vectorial + FTS español + fusión/dedupe.
 * El repositorio ejecuta cosine in-memory o pgvector `<=>` + `websearch_to_tsquery`.
 */
@Injectable()
export class HybridSearchService {
  constructor(
    @Inject(EMBEDDINGS_PORT) private readonly embeddings: EmbeddingsPort,
    @Inject(FRAGMENT_REPOSITORY) private readonly fragments: FragmentRepository,
    private readonly config: ConfigService,
  ) {}

  async search(
    query: string,
    opts?: {
      sedeId?: string | null;
      topN?: number;
      corpusIds?: string[];
      tiposDocumento?: string[];
    },
  ): Promise<HybridCandidate[]> {
    const topN = opts?.topN ?? this.resolveTopN();
    const filters = {
      sedeId: opts?.sedeId,
      corpusIds: opts?.corpusIds,
      tiposDocumento: opts?.tiposDocumento,
    };

    const { embedding: queryEmbedding } = await this.embeddings.embedOne({
      text: query,
    });
    const [vectorHits, ftsHits] = await Promise.all([
      this.fragments.searchVector(queryEmbedding, filters, topN),
      this.fragments.searchFts(query, filters, topN),
    ]);

    if (vectorHits.length === 0 && ftsHits.length === 0) return [];
    return fuseAndDedupe(vectorHits, ftsHits, topN);
  }

  private resolveTopN(): number {
    const fromConfig =
      this.config.get<number>("ai.rerank.topN") ??
      Number(this.config.get<string>("RERANK_TOP_N") ?? DEFAULT_HYBRID_TOP_N);
    const n = Number(fromConfig);
    if (!Number.isFinite(n)) return DEFAULT_HYBRID_TOP_N;
    return Math.min(20, Math.max(10, Math.floor(n)));
  }
}
