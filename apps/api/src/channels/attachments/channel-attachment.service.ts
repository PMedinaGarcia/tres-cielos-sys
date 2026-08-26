import { Injectable, Logger, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ChannelAttachmentJobService } from "../../knowledge-ingestion/jobs/channel-attachment-job.service";
import type { InboundAdjuntoRef } from "../types/inbound-message";

/**
 * Descarga (stub) + put storage + job MediaRouter.
 * Bot NO lee binarios en turno síncrono del webhook.
 */
@Injectable()
export class ChannelAttachmentService {
  private readonly logger = new Logger(ChannelAttachmentService.name);

  constructor(
    private readonly jobs: ChannelAttachmentJobService,
    @Optional() private readonly config?: ConfigService,
  ) {}

  async ingestInboundAttachments(input: {
    mensajeId: string;
    conversacionId: string;
    adjuntos: InboundAdjuntoRef[];
  }): Promise<void> {
    for (const a of input.adjuntos) {
      try {
        const buffer = await this.resolveBuffer(a);
        const job = await this.jobs.enqueueAndProcess({
          buffer,
          mime: a.mime,
          nombreArchivo: a.nombreOriginal,
          mensajeId: input.mensajeId,
          conversacionId: input.conversacionId,
        });
        if (job.result?.publicaAK) {
          this.logger.error("INVARIANT_BROKEN: adjunto publicó a K");
        }
      } catch (err) {
        this.logger.warn(`adjunto skip: ${String(err)}`);
      }
    }
  }

  private shouldFetchRemote(): boolean {
    if (this.config?.get<boolean>("storage.fetchChannelMedia")) return true;
    return process.env.FETCH_CHANNEL_MEDIA === "1";
  }

  private async resolveBuffer(a: InboundAdjuntoRef): Promise<Buffer> {
    if (a.urlExterna?.startsWith("fixture:")) {
      return Buffer.from(a.urlExterna.slice("fixture:".length), "utf8");
    }
    if (a.urlExterna && this.shouldFetchRemote()) {
      const res = await fetch(a.urlExterna);
      if (!res.ok) throw new Error(`FETCH_MEDIA_${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    }
    return Buffer.from(
      a.nombreOriginal ?? a.mime ?? "adjunto-canal",
      "utf8",
    );
  }
}
