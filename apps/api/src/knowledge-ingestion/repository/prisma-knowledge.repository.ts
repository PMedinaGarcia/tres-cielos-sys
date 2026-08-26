import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import {
  inventarioToTipoDocumento,
  mimeToPrismaTipoMaterial,
  toPrismaOrigen,
  toPrismaTipoMaterial,
} from "../../rag/material-mapping";
import type {
  DocumentoFuenteRecord,
  FragmentoRecord,
  KnowledgeRepository,
} from "./knowledge.repository";

@Injectable()
export class PrismaKnowledgeRepository implements KnowledgeRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async createDocumento(
    doc: DocumentoFuenteRecord,
  ): Promise<DocumentoFuenteRecord> {
    const bucket =
      doc.storageBucket ??
      this.config.get<string>("storage.bucket") ??
      "tres-cielos-dev";
    const tipoMaterial = mimeToPrismaTipoMaterial(doc.mime);
    const tipo = inventarioToTipoDocumento(doc.inventarioId);
    const asset = await this.prisma.asset.create({
      data: {
        proposito: "conocimiento",
        tipoMaterial,
        mimeType: doc.mime,
        nombreOriginal: doc.nombreArchivoCita ?? doc.titulo,
        storageKey: doc.storageKey,
        storageBucket: bucket,
        checksum: doc.checksum ?? null,
        bytes: doc.bytes ?? 0,
        pipelineEstado: "listo",
        sedeId: doc.sedeId ?? null,
      },
    });
    const created = await this.prisma.documentoFuente.create({
      data: {
        id: doc.id,
        titulo: doc.titulo,
        tipo,
        sede: doc.sedeId ?? null,
        version: doc.version,
        estado: doc.estadoPublicacion,
        publicadoEn: doc.publicadoEn ? new Date(doc.publicadoEn) : new Date(),
        nombreArchivoCita: doc.nombreArchivoCita ?? doc.titulo,
        inventarioId: doc.inventarioId ?? null,
        assetId: asset.id,
        tipoMaterial,
        pipelineEstado: "listo",
      },
    });
    return toRecord(created, doc, asset.id, bucket);
  }

  async nextVersion(titulo: string, sedeId?: string): Promise<number> {
    const max = await this.prisma.documentoFuente.aggregate({
      where: { titulo, sede: sedeId ?? null },
      _max: { version: true },
    });
    return (max._max.version ?? 0) + 1;
  }

  async findPublishedByTitulo(
    titulo: string,
    sedeId?: string,
  ): Promise<DocumentoFuenteRecord[]> {
    const rows = await this.prisma.documentoFuente.findMany({
      where: { titulo, sede: sedeId ?? null, estado: "publicado" },
      include: { asset: true },
    });
    return rows.map((r) => toRecordFromDb(r));
  }

  async archiveByTitulo(titulo: string, sedeId?: string): Promise<void> {
    const rows = await this.prisma.documentoFuente.findMany({
      where: { titulo, sede: sedeId ?? null, estado: "publicado" },
    });
    for (const row of rows) {
      await this.archiveDocumento(row.id);
    }
  }

  async archiveDocumento(id: string): Promise<DocumentoFuenteRecord> {
    const existing = await this.prisma.documentoFuente.findUnique({
      where: { id },
      include: { asset: true },
    });
    if (!existing) throw new Error(`DOCUMENTO_NOT_FOUND:${id}`);
    const updated = await this.prisma.documentoFuente.update({
      where: { id },
      data: { estado: "archivado" },
      include: { asset: true },
    });
    await this.deactivateFragments(id);
    return toRecordFromDb(updated);
  }

  async replaceFragments(
    documentoId: string,
    fragments: FragmentoRecord[],
  ): Promise<FragmentoRecord[]> {
    const doc = await this.prisma.documentoFuente.findUnique({
      where: { id: documentoId },
    });
    if (!doc) throw new Error(`DOCUMENTO_NOT_FOUND:${documentoId}`);
    await this.prisma.fragmentoVectorial.deleteMany({
      where: { documentoFuenteId: documentoId },
    });
    for (const f of fragments) {
      await this.prisma.fragmentoVectorial.create({
        data: {
          id: f.id,
          documentoFuenteId: documentoId,
          documentoVersion: doc.version,
          texto: f.texto,
          orden: f.orden,
          activo: f.activo,
          origenDerivacion: toPrismaOrigen(f.origenDerivacion),
          noRecuperablePrecio: f.noRecuperablePrecio,
          tipoMaterial: toPrismaTipoMaterial(String(f.tipoMaterial)),
          sedeId: doc.sede,
          tipoDocumento: doc.tipo,
        },
      });
    }
    return fragments;
  }

  async deactivateFragments(documentoId: string): Promise<void> {
    await this.prisma.fragmentoVectorial.updateMany({
      where: { documentoFuenteId: documentoId },
      data: { activo: false },
    });
  }

  async listActiveFragments(): Promise<FragmentoRecord[]> {
    const rows = await this.prisma.fragmentoVectorial.findMany({
      where: {
        activo: true,
        documentoFuente: { estado: "publicado", pipelineEstado: "listo" },
      },
    });
    return rows.map((f) => ({
      id: f.id,
      documentoId: f.documentoFuenteId,
      texto: f.texto,
      noRecuperablePrecio: f.noRecuperablePrecio,
      tipoMaterial: f.tipoMaterial ?? "pdf",
      origenDerivacion: f.origenDerivacion,
      activo: f.activo,
      orden: f.orden,
    }));
  }

  async hasPublishedInventario(inventarioId: string): Promise<boolean> {
    const n = await this.prisma.documentoFuente.count({
      where: { inventarioId, estado: "publicado" },
    });
    return n > 0;
  }

  async getDocumento(id: string): Promise<DocumentoFuenteRecord | null> {
    const row = await this.prisma.documentoFuente.findUnique({
      where: { id },
      include: { asset: true },
    });
    return row ? toRecordFromDb(row) : null;
  }
}

type DocWithAsset = Prisma.DocumentoFuenteGetPayload<{
  include: { asset: true };
}>;

function toRecordFromDb(row: DocWithAsset): DocumentoFuenteRecord {
  return {
    id: row.id,
    titulo: row.titulo,
    version: row.version,
    estadoPublicacion: row.estado,
    pipelineEstado: row.pipelineEstado,
    storageKey: row.asset.storageKey,
    storageBucket: row.asset.storageBucket,
    mime: row.asset.mimeType,
    sedeId: row.sede ?? undefined,
    familyId: row.id,
    publicadoEn: row.publicadoEn?.toISOString(),
    inventarioId: row.inventarioId ?? undefined,
    assetId: row.assetId,
    checksum: row.asset.checksum ?? undefined,
    bytes: row.asset.bytes,
    nombreArchivoCita: row.nombreArchivoCita,
  };
}

function toRecord(
  created: { id: string; version: number; estado: string; pipelineEstado: string },
  doc: DocumentoFuenteRecord,
  assetId: string,
  bucket: string,
): DocumentoFuenteRecord {
  return {
    ...doc,
    id: created.id,
    version: created.version,
    estadoPublicacion: created.estado as DocumentoFuenteRecord["estadoPublicacion"],
    pipelineEstado: created.pipelineEstado,
    assetId,
    storageBucket: bucket,
    familyId: doc.familyId,
  };
}
