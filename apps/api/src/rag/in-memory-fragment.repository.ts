import { Injectable } from "@nestjs/common";
import {
  FragmentRepository,
  HybridSearchFilters,
  ScoredFragment,
} from "./fragment.repository";
import { cosineSimilarity, ftsRank, tokenizeSpanish } from "./hybrid-search.util";
import { FragmentoRecuperable, PipelineEstado } from "./types";

/**
 * Índice in-memory (CI / AI_PROVIDERS_MODE=fake).
 * Filtros duros alineados a hybrid search (activo, publicado, listo, sede).
 */
@Injectable()
export class InMemoryFragmentRepository implements FragmentRepository {
  private store = new Map<string, FragmentoRecuperable>();

  replaceAll(fragmentos: FragmentoRecuperable[]): void {
    this.store.clear();
    for (const f of fragmentos) {
      this.store.set(f.id, f);
    }
  }

  upsert(fragmento: FragmentoRecuperable): void {
    this.store.set(fragmento.id, fragmento);
  }

  deactivate(ids: string[]): void {
    for (const id of ids) {
      const f = this.store.get(id);
      if (f) this.store.set(id, { ...f, activo: false });
    }
  }

  async getByIds(ids: string[]): Promise<FragmentoRecuperable[]> {
    return ids
      .map((id) => this.store.get(id))
      .filter((f): f is FragmentoRecuperable => f != null);
  }

  async listRecuperables(
    filters: HybridSearchFilters,
  ): Promise<FragmentoRecuperable[]> {
    return [...this.store.values()].filter((f) =>
      passesHardFilters(f, filters),
    );
  }

  async searchVector(
    queryEmbedding: number[],
    filters: HybridSearchFilters,
    topN: number,
  ): Promise<ScoredFragment[]> {
    const docs = await this.listRecuperables(filters);
    return docs
      .map((f) => ({
        fragmento: f,
        score: cosineSimilarity(queryEmbedding, f.embedding),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topN);
  }

  async searchFts(
    query: string,
    filters: HybridSearchFilters,
    topN: number,
  ): Promise<ScoredFragment[]> {
    const qTokens = tokenizeSpanish(query);
    if (qTokens.size === 0) return [];
    const docs = await this.listRecuperables(filters);
    return docs
      .map((f) => ({
        fragmento: f,
        score: ftsRank(qTokens, f.texto),
      }))
      .filter((h) => h.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topN);
  }
}

export function passesHardFilters(
  f: FragmentoRecuperable,
  filters: HybridSearchFilters,
): boolean {
  const sedeId = filters.sedeId;
  if (!f.activo) return false;
  if (f.documentoEstado !== "publicado") return false;
  if (!isPipelineListo(f.pipelineEstado)) return false;
  if (f.sedeId != null && sedeId != null && f.sedeId !== sedeId) {
    return false;
  }
  if (f.sedeId != null && (sedeId === undefined || sedeId === null)) {
    return false;
  }
  if (filters.corpusIds?.length) {
    if (!f.inventarioId || !filters.corpusIds.includes(f.inventarioId)) {
      return false;
    }
  }
  if (filters.tiposDocumento?.length) {
    if (!filters.tiposDocumento.includes(f.tipoMaterial)) {
      return false;
    }
  }
  return true;
}

function isPipelineListo(estado: PipelineEstado): boolean {
  return estado === "listo";
}
