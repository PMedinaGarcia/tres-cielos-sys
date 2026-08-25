import { Injectable } from "@nestjs/common";
import type { TipoMaterial } from "../contracts/media.types";

/**
 * Campos esperados Fase A (Prisma) — stub in-memory.
 *
 * DocumentoFuente: id, titulo, version, estado_publicacion, pipeline_estado,
 *   storage_key, mime, sede_id?, family_id, publicado_en?
 * FragmentoVectorial: id, documento_id, texto, no_recuperable_precio,
 *   tipo_material, origen_derivacion, activo, orden, embedding?, tsvector?
 * Asset: id, storage_key, mime, bytes, checksum, proposito, pipeline_estado
 * AdjuntoMensaje: id, mensaje_id, asset_id, clasificacion_intent? — NO FK a Fragmento K
 */
export interface DocumentoFuenteRecord {
  id: string;
  titulo: string;
  version: number;
  estadoPublicacion: "borrador" | "publicado" | "archivado";
  pipelineEstado: string;
  storageKey: string;
  mime: string;
  sedeId?: string;
  familyId: string;
  publicadoEn?: string;
}

export interface FragmentoRecord {
  id: string;
  documentoId: string;
  texto: string;
  noRecuperablePrecio: boolean;
  tipoMaterial: TipoMaterial | string;
  origenDerivacion: string;
  activo: boolean;
  orden: number;
}

@Injectable()
export class KnowledgeRepositoryStub {
  private documentos = new Map<string, DocumentoFuenteRecord>();
  private fragments = new Map<string, FragmentoRecord[]>();

  createDocumento(doc: DocumentoFuenteRecord): DocumentoFuenteRecord {
    this.documentos.set(doc.id, doc);
    return doc;
  }

  nextVersion(titulo: string, sedeId?: string): number {
    let max = 0;
    for (const d of this.documentos.values()) {
      if (d.titulo === titulo && d.sedeId === sedeId) {
        max = Math.max(max, d.version);
      }
    }
    return max + 1;
  }

  findPublishedByTitulo(
    titulo: string,
    sedeId?: string,
  ): DocumentoFuenteRecord[] {
    return [...this.documentos.values()].filter(
      (d) =>
        d.titulo === titulo &&
        d.sedeId === sedeId &&
        d.estadoPublicacion === "publicado",
    );
  }

  archiveByTitulo(titulo: string, sedeId?: string): void {
    for (const d of this.documentos.values()) {
      if (
        d.titulo === titulo &&
        d.sedeId === sedeId &&
        d.estadoPublicacion === "publicado"
      ) {
        d.estadoPublicacion = "archivado";
        this.deactivateFragments(d.id);
      }
    }
  }

  archiveDocumento(id: string): DocumentoFuenteRecord {
    const d = this.documentos.get(id);
    if (!d) throw new Error(`DOCUMENTO_NOT_FOUND:${id}`);
    d.estadoPublicacion = "archivado";
    return d;
  }

  replaceFragments(
    documentoId: string,
    fragments: FragmentoRecord[],
  ): FragmentoRecord[] {
    this.fragments.set(documentoId, fragments);
    return fragments;
  }

  deactivateFragments(documentoId: string): void {
    const list = this.fragments.get(documentoId) ?? [];
    for (const f of list) f.activo = false;
  }

  listActiveFragments(): FragmentoRecord[] {
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

  /** Tests */
  clear(): void {
    this.documentos.clear();
    this.fragments.clear();
  }
}
