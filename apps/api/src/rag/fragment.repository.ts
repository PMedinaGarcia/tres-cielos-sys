import { FragmentoRecuperable } from "./types";

export interface HybridSearchFilters {
  sedeId?: string | null;
  limit?: number;
  /** Inventario K / corpus ids (K01, K02, …). Vacío = todos. */
  corpusIds?: string[];
  /** tipoMaterial del fragmento (pdf, faq, word, …). Vacío = todos. */
  tiposDocumento?: string[];
}

export interface ScoredFragment {
  fragmento: FragmentoRecuperable;
  score: number;
}

export interface FragmentRepository {
  listRecuperables(filters: HybridSearchFilters): Promise<FragmentoRecuperable[]>;
  getByIds(ids: string[]): Promise<FragmentoRecuperable[]>;
  searchVector(
    queryEmbedding: number[],
    filters: HybridSearchFilters,
    topN: number,
  ): Promise<ScoredFragment[]>;
  searchFts(
    query: string,
    filters: HybridSearchFilters,
    topN: number,
  ): Promise<ScoredFragment[]>;
  replaceAll(fragmentos: FragmentoRecuperable[]): void | Promise<void>;
  upsert(fragmento: FragmentoRecuperable): void | Promise<void>;
  deactivate(ids: string[]): void | Promise<void>;
}
