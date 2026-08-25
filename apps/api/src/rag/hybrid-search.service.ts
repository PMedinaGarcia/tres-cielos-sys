import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { EmbeddingsPort } from "../ports/embeddings.port";
import { EMBEDDINGS_PORT } from "../ports/tokens";
import { FragmentRepository } from "./fragment.repository";
import { FRAGMENT_REPOSITORY } from "./tokens";
import {
  DEFAULT_HYBRID_TOP_N,
  FragmentoRecuperable,
  HybridCandidate,
  OrigenRama,
} from "./types";

const SPANISH_STOPWORDS = new Set([
  "a",
  "al",
  "con",
  "de",
  "del",
  "el",
  "en",
  "es",
  "la",
  "las",
  "lo",
  "los",
  "me",
  "mi",
  "o",
  "para",
  "por",
  "que",
  "se",
  "si",
  "su",
  "un",
  "una",
  "y",
  "ya",
  "como",
  "cual",
  "cuales",
  "cuando",
  "donde",
  "hay",
  "tiene",
  "tienen",
  "son",
  "sobre",
  "este",
  "esta",
  "estos",
  "estas",
]);

/**
 * D1 — Hybrid search: rama vectorial (embeddings) + FTS español + fusión/dedupe.
 *
 * En prod: pgvector `<=>` + `tsvector`/`websearch_to_tsquery('spanish')`.
 * Aquí: cosine + ranking léxico español sobre InMemoryFragmentRepository
 * (hasta que Fase A exponga FragmentoVectorial en Prisma).
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
    const recuperables = await this.fragments.listRecuperables({
      sedeId: opts?.sedeId,
      corpusIds: opts?.corpusIds,
      tiposDocumento: opts?.tiposDocumento,
    });

    if (recuperables.length === 0) return [];

    const { embedding: queryEmbedding } = await this.embeddings.embedOne({
      text: query,
    });
    const vectorHits = this.vectorBranch(queryEmbedding, recuperables, topN);
    const ftsHits = this.ftsBranch(query, recuperables, topN);

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

  private vectorBranch(
    queryEmbedding: number[],
    docs: FragmentoRecuperable[],
    limit: number,
  ): Array<{ fragmento: FragmentoRecuperable; score: number }> {
    return docs
      .map((f) => ({
        fragmento: f,
        score: cosineSimilarity(queryEmbedding, f.embedding),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private ftsBranch(
    query: string,
    docs: FragmentoRecuperable[],
    limit: number,
  ): Array<{ fragmento: FragmentoRecuperable; score: number }> {
    const qTokens = tokenizeSpanish(query);
    if (qTokens.size === 0) return [];

    return docs
      .map((f) => ({
        fragmento: f,
        score: ftsRank(qTokens, f.texto),
      }))
      .filter((h) => h.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

export function tokenizeSpanish(text: string): Set<string> {
  const raw = text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((t) => t.length > 2 && !SPANISH_STOPWORDS.has(t));
  return new Set(raw);
}

export function ftsRank(queryTokens: Set<string>, docText: string): number {
  const docTokens = tokenizeSpanish(docText);
  if (docTokens.size === 0) return 0;
  let hits = 0;
  for (const t of queryTokens) {
    if (docTokens.has(t)) hits += 1;
  }
  if (hits === 0) return 0;
  return hits / queryTokens.size + hits / (docTokens.size + 1);
}

export function fuseAndDedupe(
  vectorHits: Array<{ fragmento: FragmentoRecuperable; score: number }>,
  ftsHits: Array<{ fragmento: FragmentoRecuperable; score: number }>,
  topN: number,
): HybridCandidate[] {
  const map = new Map<string, HybridCandidate>();

  for (const h of vectorHits) {
    map.set(h.fragmento.id, {
      fragmento: h.fragmento,
      scoreHybrid: h.score,
      scoreVector: h.score,
      origenRama: "vector",
    });
  }

  for (const h of ftsHits) {
    const existing = map.get(h.fragmento.id);
    if (!existing) {
      map.set(h.fragmento.id, {
        fragmento: h.fragmento,
        scoreHybrid: h.score,
        scoreFts: h.score,
        origenRama: "fts",
      });
      continue;
    }
    existing.scoreFts = h.score;
    existing.origenRama = "ambos" satisfies OrigenRama;
    existing.scoreHybrid = Math.max(existing.scoreHybrid, h.score);
  }

  return [...map.values()]
    .sort((a, b) => b.scoreHybrid - a.scoreHybrid)
    .slice(0, topN);
}
