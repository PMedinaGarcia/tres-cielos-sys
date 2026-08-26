import { Injectable } from "@nestjs/common";
import type {
  DocumentoFuenteRecord,
  FragmentoRecord,
  KnowledgeRepository,
} from "./knowledge.repository";

/**
 * Stub in-memory para tests. PrismaKnowledgeRepository es el store live.
 */
@Injectable()
export class KnowledgeRepositoryStub implements KnowledgeRepository {
  private documentos = new Map<string, DocumentoFuenteRecord>();
  private fragments = new Map<string, FragmentoRecord[]>();

  async createDocumento(
    doc: DocumentoFuenteRecord,
  ): Promise<DocumentoFuenteRecord> {
    this.documentos.set(doc.id, doc);
    return doc;
  }

  async nextVersion(titulo: string, sedeId?: string): Promise<number> {
    let max = 0;
    for (const d of this.documentos.values()) {
      if (d.titulo === titulo && d.sedeId === sedeId) {
        max = Math.max(max, d.version);
      }
    }
    return max + 1;
  }

  async findPublishedByTitulo(
    titulo: string,
    sedeId?: string,
  ): Promise<DocumentoFuenteRecord[]> {
    return [...this.documentos.values()].filter(
      (d) =>
        d.titulo === titulo &&
        d.sedeId === sedeId &&
        d.estadoPublicacion === "publicado",
    );
  }

  async archiveByTitulo(titulo: string, sedeId?: string): Promise<void> {
    for (const d of this.documentos.values()) {
      if (
        d.titulo === titulo &&
        d.sedeId === sedeId &&
        d.estadoPublicacion === "publicado"
      ) {
        d.estadoPublicacion = "archivado";
        await this.deactivateFragments(d.id);
      }
    }
  }

  async archiveDocumento(id: string): Promise<DocumentoFuenteRecord> {
    const d = this.documentos.get(id);
    if (!d) throw new Error(`DOCUMENTO_NOT_FOUND:${id}`);
    d.estadoPublicacion = "archivado";
    return d;
  }

  async replaceFragments(
    documentoId: string,
    fragments: FragmentoRecord[],
  ): Promise<FragmentoRecord[]> {
    this.fragments.set(documentoId, fragments);
    return fragments;
  }

  async deactivateFragments(documentoId: string): Promise<void> {
    const list = this.fragments.get(documentoId) ?? [];
    for (const f of list) f.activo = false;
  }

  async listActiveFragments(): Promise<FragmentoRecord[]> {
    const out: FragmentoRecord[] = [];
    for (const [docId, frags] of this.fragments) {
      const doc = this.documentos.get(docId);
      if (!doc || doc.estadoPublicacion !== "publicado") continue;
      if (doc.pipelineEstado !== "listo") continue;
      for (const f of frags) {
        if (f.activo) out.push(f);
      }
    }
    return out;
  }

  async hasPublishedInventario(inventarioId: string): Promise<boolean> {
    return [...this.documentos.values()].some(
      (d) =>
        d.inventarioId === inventarioId && d.estadoPublicacion === "publicado",
    );
  }

  async getDocumento(id: string): Promise<DocumentoFuenteRecord | null> {
    return this.documentos.get(id) ?? null;
  }

  /** Tests */
  clear(): void {
    this.documentos.clear();
    this.fragments.clear();
  }
}
