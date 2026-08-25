import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { randomUUID } from "crypto";
import type { ParsedFragment, TipoMaterial } from "../contracts/media.types";
import {
  KnowledgeRepositoryStub,
  type DocumentoFuenteRecord,
  type FragmentoRecord,
} from "../repository/knowledge.repository.stub";
import { MediaRouterService } from "../media-router.service";
import { SlaTrackerService } from "./sla-tracker.service";
import { FRAGMENT_REPOSITORY } from "../../rag/tokens";
import type { FragmentRepository } from "../../rag/fragment.repository";
import type { FragmentoRecuperable, TipoMaterial as RagTipoMaterial } from "../../rag/types";
import { hashToEmbedding } from "../../ports/__fakes__/hash";
import { EMBEDDINGS_PORT } from "../../ports/tokens";
import type { EmbeddingsPort } from "../../ports/embeddings.port";

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
 * Bridge: upsert al mismo FRAGMENT_REPOSITORY que usa RAG.
 */
@Injectable()
export class PublishArchiveService {
  private readonly logger = new Logger(PublishArchiveService.name);
  private readonly ragIdsByDocumento = new Map<string, string[]>();

  constructor(
    private readonly mediaRouter: MediaRouterService,
    private readonly repo: KnowledgeRepositoryStub,
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
    const routed = await this.mediaRouter.route({
      buffer: input.buffer,
      mime: input.mime,
      nombreArchivo: input.nombreArchivo,
      origen: "biblioteca_k",
    });

    if (!routed.ok || !routed.publicaAK) {
      throw new Error(
        `PUBLISH_FAILED:${routed.motivoRechazo ?? routed.errorTipificado ?? "unknown"}`,
      );
    }

    const previous = this.repo.findPublishedByTitulo(input.titulo, input.sedeId);
    for (const old of previous) {
      this.deactivateRagForDocumento(old.id);
    }

    const familyId = randomUUID();
    this.repo.archiveByTitulo(input.titulo, input.sedeId);

    const documento = this.repo.createDocumento({
      id: randomUUID(),
      titulo: input.titulo,
      version: this.repo.nextVersion(input.titulo, input.sedeId),
      estadoPublicacion: "publicado",
      pipelineEstado: "listo",
      storageKey: routed.storageKey!,
      mime: input.mime,
      sedeId: input.sedeId,
      familyId,
      publicadoEn: new Date().toISOString(),
    });

    const fragments = this.repo.replaceFragments(
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

    const inventarioId =
      input.inventarioId ?? inferInventarioId(input.titulo);
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
      this.sla.record(tipo, routed.slaMs, documento.storageKey);
    }

    return { documento, fragments, sla: this.sla.latest() };
  }

  async archive(documentoId: string): Promise<DocumentoFuenteRecord> {
    const doc = this.repo.archiveDocumento(documentoId);
    this.repo.deactivateFragments(documentoId);
    this.deactivateRagForDocumento(documentoId);
    return doc;
  }

  listActiveFragments(): FragmentoRecord[] {
    return this.repo.listActiveFragments();
  }

  private deactivateRagForDocumento(documentoId: string): void {
    const ids = this.ragIdsByDocumento.get(documentoId) ?? [];
    if (ids.length && this.ragFragments) {
      this.ragFragments.deactivate(ids);
    }
    this.ragIdsByDocumento.delete(documentoId);
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
        tipoMaterial: toRagTipoMaterial(f.tipoMaterial),
        origenDerivacion: toOrigen(f.origenDerivacion),
        noRecuperablePrecio: f.noRecuperablePrecio,
        nombreArchivoCita,
        inventarioId,
      };
      this.ragFragments.upsert(recuperable);
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

function toRagTipoMaterial(t: TipoMaterial | string): RagTipoMaterial {
  switch (t) {
    case "docx":
      return "word";
    case "imagen":
      return "foto";
    case "xlsx":
    case "csv":
      return "xls";
    case "pdf":
      return "pdf";
    case "video":
      return "video";
    default:
      return "otro";
  }
}

function toOrigen(
  o: string,
): FragmentoRecuperable["origenDerivacion"] {
  if (
    o === "nativo" ||
    o === "texto_nativo" ||
    o === "vision" ||
    o === "whisper" ||
    o === "xls_narrativo"
  ) {
    return o;
  }
  return "texto_nativo";
}
