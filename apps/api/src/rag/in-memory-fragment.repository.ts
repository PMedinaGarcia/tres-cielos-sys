import { Injectable } from "@nestjs/common";
import {
  FragmentRepository,
  HybridSearchFilters,
} from "./fragment.repository";
import { FragmentoRecuperable, PipelineEstado } from "./types";

/**
 * Stub in-memory hasta que Fase A exponga FragmentoVectorial + pgvector/FTS en Prisma.
 * Reproduce los filtros duros del hybrid search (activo, publicado, listo, sede).
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
    const all = [...this.store.values()];
    return all.filter((f) => passesHardFilters(f, filters));
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
