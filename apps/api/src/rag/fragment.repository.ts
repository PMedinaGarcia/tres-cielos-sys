import { FragmentoRecuperable } from "./types";

export interface HybridSearchFilters {
  sedeId?: string | null;
  limit?: number;
  /** Inventario K / corpus ids (K01, K02, …). Vacío = todos. */
  corpusIds?: string[];
  /** tipoMaterial del fragmento (pdf, faq, word, …). Vacío = todos. */
  tiposDocumento?: string[];
}

export interface FragmentRepository {
  listRecuperables(filters: HybridSearchFilters): Promise<FragmentoRecuperable[]>;
  getByIds(ids: string[]): Promise<FragmentoRecuperable[]>;
  replaceAll(fragmentos: FragmentoRecuperable[]): void;
  upsert(fragmento: FragmentoRecuperable): void;
  deactivate(ids: string[]): void;
}
