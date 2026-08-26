import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { randomUUID } from "crypto";
import type { ParsedFragment, TipoMaterial } from "../contracts/media.types";
import {
  KNOWLEDGE_REPOSITORY,
  type DocumentoFuenteRecord,
  type FragmentoRecord,
  type KnowledgeRepository,
} from "../repository/knowledge.repository";
import { MediaRouterService } from "../media-router.service";
import { SlaTrackerService } from "./sla-tracker.service";
import { FRAGMENT_REPOSITORY } from "../../rag/tokens";
import type { FragmentRepository } from "../../rag/fragment.repository";
import type { FragmentoRecuperable } from "../../rag/types";
import { hashToEmbedding } from "../../ports/__fakes__/hash";
import { EMBEDDINGS_PORT } from "../../ports/tokens";
import type { EmbeddingsPort } from "../../ports/embeddings.port";
import { STORAGE_PREFIXES } from "../../ports/storage-prefixes";
import {
  toOrigenDerivacion,
  toRagTipoMaterial,
} from "../../rag/material-mapping";

export interface PublishInput {
  titulo: string;
  mime: string;
  buffer: Buffer;
  nombreArchivo?: string;
  sedeId?: string;
  inventarioId?: string;
}

/**
 * Publicar/archivar biblioteca K + invalidación de versión anterior.
 * Persistencia: KnowledgeRepository (stub o Prisma) + FRAGMENT_REPOSITORY.
 */
@Injectable()
export class PublishArchiveService {
  private readonly logger = new Logger(PublishArchiveService.name);
  private readonly ragIdsByDocumento = new Map<string, string[]>();

  constructor(
    private readonly mediaRouter: MediaRouterService,
    @Inject(KNOWLEDGE_REPOSITORY) private readonly repo: KnowledgeRepository,
    private readonly sla: SlaTrackerService,
    @Optional() @Inject(FRAGMENT_REPOSITORY)
    private readonly ragFragments?: FragmentRepository,
    @Optional() @Inject(EMBEDDINGS_PORT)
    private readonly embeddings?: EmbeddingsPort,
  ) {}

  async publish(input: PublishInput): Promise<{
    documento: DocumentoFuenteRecord;
    fragments: FragmentoRecord[];
    sla: ReturnType<SlaTrackerService["latest"]>;
  }> {
    const documentoId = randomUUID();
    const routed = await this.mediaRouter.route({
      buffer: input.buffer,
      mime: input.mime,
      nombreArchivo: input.nombreArchivo,
      origen: "biblioteca_k",
      keyPrefix: `${STORAGE_PREFIXES.conocimiento}/${documentoId}`,
    });

    if (!routed.ok || !routed.publicaAK) {
      throw new Error(
        `PUBLISH_FAILED:${routed.motivoRechazo ?? routed.errorTipificado ?? "unknown"}`,
      );
    }

    const previous = await this.repo.findPublishedByTitulo(
      input.titulo,
      input.sedeId,
    );
    for (const old of previous) {
      await this.deactivateRagForDocumento(old.id);
    }

    const familyId = randomUUID();
    await this.repo.archiveByTitulo(input.titulo, input.sedeId);

    const inventarioId =
      input.inventarioId ?? inferInventarioId(input.titulo);
    const documento = await this.repo.createDocumento({
      id: documentoId,
      titulo: input.titulo,
      version: await this.repo.nextVersion(input.titulo, input.sedeId),
      estadoPublicacion: "publicado",
      pipelineEstado: "listo",
      storageKey: routed.storageKey!,
      storageBucket: routed.storageBucket,
      mime: input.mime,
      sedeId: input.sedeId,
      familyId,
      publicadoEn: new Date().toISOString(),
      inventarioId,
      checksum: routed.checksum,
      bytes: routed.bytes ?? input.buffer.length,
      nombreArchivoCita: input.nombreArchivo ?? input.titulo,
    });

    const fragments = await this.repo.replaceFragments(
      documento.id,
      routed.fragments.map((f: ParsedFragment, i) => ({
        id: randomUUID(),
        documentoId: documento.id,
        texto: f.texto,
        noRecuperablePrecio: f.noRecuperablePrecio,
        tipoMaterial: f.tipoMaterial,
        origenDerivacion: f.origenDerivacion,
        activo: true,
        orden: f.orden ?? i,
      })),
    );

    await this.indexInRag(
      documento,
      fragments,
      input.nombreArchivo ?? input.titulo,
      inventarioId,
    );

    this.logger.log(
      `publicado ${documento.id} v${documento.version} fragments=${fragments.length}`,
    );

    const tipo = routed.fragments[0]?.tipoMaterial ?? "pdf";
    if (routed.slaMs !== undefined) {
      this.sla.record(tipo as TipoMaterial, routed.slaMs, documento.storageKey);
    }

    return { documento, fragments, sla: this.sla.latest() };
  }

  async archive(documentoId: string): Promise<DocumentoFuenteRecord> {
    const doc = await this.repo.archiveDocumento(documentoId);
    await this.repo.deactivateFragments(documentoId);
    await this.deactivateRagForDocumento(documentoId);
    return doc;
  }

  async listActiveFragments(): Promise<FragmentoRecord[]> {
    return this.repo.listActiveFragments();
  }

  private async deactivateRagForDocumento(documentoId: string): Promise<void> {
    const ids = this.ragIdsByDocumento.get(documentoId) ?? [];
    if (ids.length && this.ragFragments) {
      await this.ragFragments.deactivate(ids);
    }
    this.ragIdsByDocumento.delete(documentoId);
    if (!ids.length && this.ragFragments) {
      const remaining = await this.repo.listActiveFragments();
      const stale = remaining
        .filter((f) => f.documentoId === documentoId)
        .map((f) => f.id);
      if (stale.length) await this.ragFragments.deactivate(stale);
    }
  }

  private async indexInRag(
    documento: DocumentoFuenteRecord,
    fragments: FragmentoRecord[],
    nombreArchivoCita: string,
    inventarioId?: string,
  ): Promise<void> {
    if (!this.ragFragments) return;
    const ids: string[] = [];
    for (const f of fragments) {
      const embedding = await this.embedText(f.texto);
      const recuperable: FragmentoRecuperable = {
        id: f.id,
        texto: f.texto,
        embedding,
        activo: f.activo,
        documentoEstado: "publicado",
        pipelineEstado: "listo",
        sedeId: documento.sedeId ?? null,
        tipoMaterial: toRagTipoMaterial(undefined, String(f.tipoMaterial)),
        origenDerivacion: toOrigenDerivacion(f.origenDerivacion),
        noRecuperablePrecio: f.noRecuperablePrecio,
        nombreArchivoCita,
        inventarioId,
      };
      await this.ragFragments.upsert(recuperable);
      ids.push(f.id);
    }
    this.ragIdsByDocumento.set(documento.id, ids);
  }

  private async embedText(text: string): Promise<number[]> {
    if (this.embeddings) {
      const { embedding } = await this.embeddings.embedOne({ text });
      return embedding;
    }
    return hashToEmbedding(text);
  }
}

function inferInventarioId(titulo: string): string | undefined {
  const m = titulo.trim().match(/^(K\d+)/i);
  return m ? m[1]!.toUpperCase() : undefined;
}
