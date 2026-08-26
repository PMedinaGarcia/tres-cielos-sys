import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type {
  FragmentRepository,
  HybridSearchFilters,
  ScoredFragment,
} from "./fragment.repository";
import {
  parsePgVector,
  toEstadoDocumento,
  toOrigenDerivacion,
  toPgVectorLiteral,
  toPipelineEstado,
  toPrismaOrigen,
  toPrismaTipoMaterial,
  toRagTipoMaterial,
} from "./material-mapping";
import type { FragmentoRecuperable } from "./types";

interface HybridRow {
  id: string;
  texto: string;
  embedding: string | null;
  activo: boolean;
  sede_id: string | null;
  tipo_material: string | null;
  origen_derivacion: string;
  no_recuperable_precio: boolean;
  documento_estado: string;
  pipeline_estado: string;
  nombre_archivo_cita: string;
  inventario_id: string | null;
  tipo_documento: string | null;
  score: number;
}

/**
 * pgvector cosine (`<=>`) + FTS español. Filtros duros = `passesHardFilters`.
 */
@Injectable()
export class PrismaFragmentRepository implements FragmentRepository {
  private readonly logger = new Logger(PrismaFragmentRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async replaceAll(_fragmentos: FragmentoRecuperable[]): Promise<void> {
    this.logger.warn("replaceAll ignorado en PrismaFragmentRepository");
  }

  async upsert(fragmento: FragmentoRecuperable): Promise<void> {
    const existing = await this.prisma.fragmentoVectorial.findUnique({
      where: { id: fragmento.id },
    });
    if (!existing) {
      this.logger.warn(`upsert skip: fragmento ${fragmento.id} no existe en DB`);
      return;
    }
    await this.prisma.fragmentoVectorial.update({
      where: { id: fragmento.id },
      data: {
        texto: fragmento.texto,
        activo: fragmento.activo,
        noRecuperablePrecio: fragmento.noRecuperablePrecio,
        sedeId: fragmento.sedeId,
        tipoMaterial: toPrismaTipoMaterial(fragmento.tipoMaterial),
        origenDerivacion: toPrismaOrigen(fragmento.origenDerivacion),
      },
    });
    await this.writeEmbedding(fragmento.id, fragmento.embedding);
  }

  async deactivate(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.prisma.fragmentoVectorial.updateMany({
      where: { id: { in: ids } },
      data: { activo: false },
    });
  }

  async getByIds(ids: string[]): Promise<FragmentoRecuperable[]> {
    if (ids.length === 0) return [];
    const rows = await this.prisma.$queryRaw<HybridRow[]>(Prisma.sql`
      SELECT
        f.id,
        f.texto,
        f.embedding::text AS embedding,
        f.activo,
        f.sede_id,
        f.tipo_material,
        f.origen_derivacion,
        f.no_recuperable_precio,
        d.estado AS documento_estado,
        d.pipeline_estado,
        d.nombre_archivo_cita,
        d.inventario_id,
        d.tipo AS tipo_documento,
        0::float8 AS score
      FROM fragmentos_vectoriales f
      JOIN documentos_fuente d ON d.id = f.documento_fuente_id
      WHERE f.id IN (${Prisma.join(ids)})
    `);
    return rows.map(mapRow);
  }

  async listRecuperables(
    filters: HybridSearchFilters,
  ): Promise<FragmentoRecuperable[]> {
    const rows = await this.prisma.$queryRaw<HybridRow[]>(Prisma.sql`
      SELECT
        f.id,
        f.texto,
        f.embedding::text AS embedding,
        f.activo,
        f.sede_id,
        f.tipo_material,
        f.origen_derivacion,
        f.no_recuperable_precio,
        d.estado AS documento_estado,
        d.pipeline_estado,
        d.nombre_archivo_cita,
        d.inventario_id,
        d.tipo AS tipo_documento,
        0::float8 AS score
      FROM fragmentos_vectoriales f
      JOIN documentos_fuente d ON d.id = f.documento_fuente_id
      WHERE ${hardFilterSql(filters)}
    `);
    return rows.map(mapRow).filter((f) => passesTipos(f, filters));
  }

  async searchVector(
    queryEmbedding: number[],
    filters: HybridSearchFilters,
    topN: number,
  ): Promise<ScoredFragment[]> {
    if (queryEmbedding.length === 0) return [];
    const vec = toPgVectorLiteral(queryEmbedding);
    const fetchN = Math.max(topN * 5, 50);
    const rows = await this.prisma.$queryRaw<HybridRow[]>(Prisma.sql`
      SELECT
        f.id,
        f.texto,
        f.embedding::text AS embedding,
        f.activo,
        f.sede_id,
        f.tipo_material,
        f.origen_derivacion,
        f.no_recuperable_precio,
        d.estado AS documento_estado,
        d.pipeline_estado,
        d.nombre_archivo_cita,
        d.inventario_id,
        d.tipo AS tipo_documento,
        (1 - (f.embedding <=> ${vec}::vector))::float8 AS score
      FROM fragmentos_vectoriales f
      JOIN documentos_fuente d ON d.id = f.documento_fuente_id
      WHERE ${hardFilterSql(filters)}
        AND f.embedding IS NOT NULL
      ORDER BY f.embedding <=> ${vec}::vector
      LIMIT ${fetchN}
    `);
    return rows
      .map((row) => ({ fragmento: mapRow(row), score: Number(row.score) }))
      .filter((h) => passesTipos(h.fragmento, filters))
      .slice(0, topN);
  }

  async searchFts(
    query: string,
    filters: HybridSearchFilters,
    topN: number,
  ): Promise<ScoredFragment[]> {
    const q = query.trim();
    if (!q) return [];
    const fetchN = Math.max(topN * 5, 50);
    try {
      const rows = await this.prisma.$queryRaw<HybridRow[]>(Prisma.sql`
        SELECT
          f.id,
          f.texto,
          f.embedding::text AS embedding,
          f.activo,
          f.sede_id,
          f.tipo_material,
          f.origen_derivacion,
          f.no_recuperable_precio,
          d.estado AS documento_estado,
          d.pipeline_estado,
          d.nombre_archivo_cita,
          d.inventario_id,
          d.tipo AS tipo_documento,
          ts_rank(f.tsv, websearch_to_tsquery('spanish', ${q}))::float8 AS score
        FROM fragmentos_vectoriales f
        JOIN documentos_fuente d ON d.id = f.documento_fuente_id
        WHERE ${hardFilterSql(filters)}
          AND f.tsv @@ websearch_to_tsquery('spanish', ${q})
        ORDER BY score DESC
        LIMIT ${fetchN}
      `);
      return rows
        .map((row) => ({ fragmento: mapRow(row), score: Number(row.score) }))
        .filter((h) => h.score > 0 && passesTipos(h.fragmento, filters))
        .slice(0, topN);
    } catch (err) {
      this.logger.warn(`FTS query skipped: ${String(err)}`);
      return [];
    }
  }

  private async writeEmbedding(id: string, embedding: number[]): Promise<void> {
    if (!embedding.length) return;
    const literal = toPgVectorLiteral(embedding);
    await this.prisma.$executeRawUnsafe(
      `UPDATE fragmentos_vectoriales SET embedding = $1::vector WHERE id = $2`,
      literal,
      id,
    );
  }
}

export function hardFilterSql(filters: HybridSearchFilters): Prisma.Sql {
  const parts: Prisma.Sql[] = [
    Prisma.sql`f.activo = true`,
    Prisma.sql`d.estado = 'publicado'`,
    Prisma.sql`d.pipeline_estado = 'listo'`,
  ];
  if (filters.sedeId == null) {
    parts.push(Prisma.sql`f.sede_id IS NULL`);
  } else {
    parts.push(
      Prisma.sql`(f.sede_id IS NULL OR f.sede_id = ${filters.sedeId})`,
    );
  }
  if (filters.corpusIds?.length) {
    parts.push(
      Prisma.sql`d.inventario_id IN (${Prisma.join(filters.corpusIds)})`,
    );
  }
  return Prisma.join(parts, " AND ");
}

function mapRow(row: HybridRow): FragmentoRecuperable {
  return {
    id: row.id,
    texto: row.texto,
    embedding: parsePgVector(row.embedding),
    activo: row.activo,
    documentoEstado: toEstadoDocumento(row.documento_estado),
    pipelineEstado: toPipelineEstado(row.pipeline_estado),
    sedeId: row.sede_id,
    tipoMaterial: toRagTipoMaterial(row.tipo_documento, row.tipo_material),
    origenDerivacion: toOrigenDerivacion(row.origen_derivacion),
    noRecuperablePrecio: row.no_recuperable_precio,
    nombreArchivoCita: row.nombre_archivo_cita,
    inventarioId: row.inventario_id ?? undefined,
  };
}

function passesTipos(
  f: FragmentoRecuperable,
  filters: HybridSearchFilters,
): boolean {
  if (!filters.tiposDocumento?.length) return true;
  return filters.tiposDocumento.includes(f.tipoMaterial);
}
