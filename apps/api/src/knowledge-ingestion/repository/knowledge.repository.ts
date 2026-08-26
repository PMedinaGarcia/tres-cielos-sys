import type { TipoMaterial } from "../contracts/media.types";

export interface DocumentoFuenteRecord {
  id: string;
  titulo: string;
  version: number;
  estadoPublicacion: "borrador" | "publicado" | "archivado";
  pipelineEstado: string;
  storageKey: string;
  storageBucket?: string;
  mime: string;
  sedeId?: string;
  familyId: string;
  publicadoEn?: string;
  inventarioId?: string;
  assetId?: string;
  checksum?: string;
  bytes?: number;
  nombreArchivoCita?: string;
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

export const KNOWLEDGE_REPOSITORY = Symbol("KNOWLEDGE_REPOSITORY");

export interface KnowledgeRepository {
  createDocumento(doc: DocumentoFuenteRecord): Promise<DocumentoFuenteRecord>;
  nextVersion(titulo: string, sedeId?: string): Promise<number>;
  findPublishedByTitulo(
    titulo: string,
    sedeId?: string,
  ): Promise<DocumentoFuenteRecord[]>;
  archiveByTitulo(titulo: string, sedeId?: string): Promise<void>;
  archiveDocumento(id: string): Promise<DocumentoFuenteRecord>;
  replaceFragments(
    documentoId: string,
    fragments: FragmentoRecord[],
  ): Promise<FragmentoRecord[]>;
  deactivateFragments(documentoId: string): Promise<void>;
  listActiveFragments(): Promise<FragmentoRecord[]>;
  hasPublishedInventario(inventarioId: string): Promise<boolean>;
  getDocumento(id: string): Promise<DocumentoFuenteRecord | null>;
}
