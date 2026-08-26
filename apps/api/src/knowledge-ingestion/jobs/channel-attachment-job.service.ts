import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { MIME_ALLOWLIST } from "../contracts/media.types";
import type { MediaRouteResult } from "../contracts/media.types";
import { MediaRouterService } from "../media-router.service";
import { STORAGE_PREFIXES } from "../../ports/storage-prefixes";

export interface ChannelAttachmentJob {
  id: string;
  mensajeId: string;
  conversacionId: string;
  mime: string;
  nombreArchivo?: string;
  status: "queued" | "done" | "error";
  result?: MediaRouteResult;
  assetId?: string;
  createdAt: string;
}

/**
 * Job adjunto de canal: storage + MediaRouter + Asset Prisma.
 * T-MED-LEAD: NO publica a biblioteca K.
 */
@Injectable()
export class ChannelAttachmentJobService {
  private readonly logger = new Logger(ChannelAttachmentJobService.name);
  private readonly jobs = new Map<string, ChannelAttachmentJob>();

  constructor(
    private readonly mediaRouter: MediaRouterService,
    @Optional() private readonly prisma?: PrismaService,
    @Optional() private readonly config?: ConfigService,
  ) {}

  async enqueueAndProcess(input: {
    buffer: Buffer;
    mime: string;
    nombreArchivo?: string;
    mensajeId: string;
    conversacionId: string;
    duracionMs?: number;
  }): Promise<ChannelAttachmentJob> {
    const job: ChannelAttachmentJob = {
      id: randomUUID(),
      mensajeId: input.mensajeId,
      conversacionId: input.conversacionId,
      mime: input.mime,
      nombreArchivo: input.nombreArchivo,
      status: "queued",
      createdAt: new Date().toISOString(),
    };
    this.jobs.set(job.id, job);

    try {
      const result = await this.mediaRouter.route({
        buffer: input.buffer,
        mime: input.mime,
        nombreArchivo: input.nombreArchivo,
        origen: "adjunto_canal",
        duracionMs: input.duracionMs,
        keyPrefix: `${STORAGE_PREFIXES.adjuntoCanal}/${input.mensajeId}`,
      });
      result.publicaAK = false;
      job.result = result;
      job.status = result.ok ? "done" : "error";
      if (result.ok && result.storageKey) {
        job.assetId = await this.persistAsset(input, result);
      }
      this.logger.log(
        `adjunto canal job=${job.id} publicaAK=${result.publicaAK} estado=${result.pipelineEstado}`,
      );
    } catch (err) {
      job.status = "error";
      job.result = {
        ok: false,
        pipelineEstado: "error",
        fragments: [],
        publicaAK: false,
        errorTipificado: "proveedor_ia",
      };
      this.logger.error(`adjunto job failed: ${String(err)}`);
    }

    return job;
  }

  get(id: string): ChannelAttachmentJob | undefined {
    return this.jobs.get(id);
  }

  /** Tests: ningún job de canal marca publicaAK */
  assertNoKPublication(): boolean {
    for (const j of this.jobs.values()) {
      if (j.result?.publicaAK) return false;
    }
    return true;
  }

  private async persistAsset(
    input: {
      buffer: Buffer;
      mime: string;
      nombreArchivo?: string;
      mensajeId: string;
    },
    result: MediaRouteResult,
  ): Promise<string | undefined> {
    if (!this.prisma || !result.storageKey) return undefined;
    const tipoMaterial = MIME_ALLOWLIST[input.mime] ?? "pdf";
    const bucket =
      result.storageBucket ??
      this.config?.get<string>("storage.bucket") ??
      "tres-cielos-dev";
    const asset = await this.prisma.asset.create({
      data: {
        proposito: "adjunto_canal",
        tipoMaterial,
        mimeType: input.mime,
        nombreOriginal: input.nombreArchivo ?? "adjunto",
        storageKey: result.storageKey,
        storageBucket: bucket,
        checksum: result.checksum ?? null,
        bytes: result.bytes ?? input.buffer.length,
        pipelineEstado: result.ok ? "listo" : "error",
      },
    });
    const mensaje = await this.prisma.mensaje.findFirst({
      where: { externalMessageId: input.mensajeId },
    });
    if (mensaje) {
      const updated = await this.prisma.adjuntoMensaje.updateMany({
        where: { mensajeId: mensaje.id, storageKey: null },
        data: {
          assetId: asset.id,
          storageKey: result.storageKey,
          bytes: result.bytes ?? input.buffer.length,
        },
      });
      if (updated.count === 0) {
        await this.prisma.adjuntoMensaje.create({
          data: {
            mensajeId: mensaje.id,
            assetId: asset.id,
            mimeType: input.mime,
            nombreOriginal: input.nombreArchivo ?? null,
            storageKey: result.storageKey,
            bytes: result.bytes ?? input.buffer.length,
          },
        });
      }
    }
    return asset.id;
  }
}
