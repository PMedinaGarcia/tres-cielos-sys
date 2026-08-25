import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "crypto";
import { MediaRouterService } from "../media-router.service";
import type { MediaRouteResult } from "../contracts/media.types";

export interface ChannelAttachmentJob {
  id: string;
  mensajeId: string;
  conversacionId: string;
  mime: string;
  nombreArchivo?: string;
  status: "queued" | "done" | "error";
  result?: MediaRouteResult;
  createdAt: string;
}

/**
 * Job adjunto de canal: storage + MediaRouter.
 * T-MED-LEAD: NO publica a biblioteca K.
 */
@Injectable()
export class ChannelAttachmentJobService {
  private readonly logger = new Logger(ChannelAttachmentJobService.name);
  private readonly jobs = new Map<string, ChannelAttachmentJob>();

  constructor(private readonly mediaRouter: MediaRouterService) {}

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
      });
      // Invariante T-MED-LEAD
      result.publicaAK = false;
      job.result = result;
      job.status = result.ok ? "done" : "error";
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
}
