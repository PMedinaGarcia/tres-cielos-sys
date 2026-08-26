import { createHash, randomUUID } from "crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { OBJECT_STORAGE_PORT } from "./contracts/port-tokens";
import type { ObjectStoragePort } from "./contracts/object-storage.port";
import { STORAGE_PREFIXES } from "../ports/storage-prefixes";
import {
  MEDIA_LIMITS,
  MIME_ALLOWLIST,
  SLA_MS,
  type MediaRouteResult,
  type OrigenMedia,
  type TipoMaterial,
} from "./contracts/media.types";
import { SourcePluginRegistry } from "./plugins/source-plugin.registry";
import { SlaTrackerService } from "./jobs/sla-tracker.service";

export interface MediaRouteInput {
  buffer: Buffer;
  mime: string;
  nombreArchivo?: string;
  origen: OrigenMedia;
  /** Solo video */
  duracionMs?: number;
  /** Prefijo storage */
  keyPrefix?: string;
}

@Injectable()
export class MediaRouterService {
  private readonly logger = new Logger(MediaRouterService.name);

  constructor(
    @Inject(OBJECT_STORAGE_PORT) private readonly storage: ObjectStoragePort,
    private readonly plugins: SourcePluginRegistry,
    private readonly sla: SlaTrackerService,
  ) {}

  async route(input: MediaRouteInput): Promise<MediaRouteResult> {
    const started = Date.now();
    const tipo = MIME_ALLOWLIST[input.mime];
    if (!tipo) {
      return {
        ok: false,
        pipelineEstado: "rechazado",
        fragments: [],
        publicaAK: false,
        motivoRechazo: "adjunto_no_soportado",
      };
    }

    const sizeFail = this.checkSize(tipo, input.buffer.length);
    if (sizeFail) {
      return {
        ok: false,
        pipelineEstado: "rechazado",
        fragments: [],
        publicaAK: false,
        motivoRechazo: sizeFail,
      };
    }

    const plugin = this.plugins.resolve(input.mime);
    if (!plugin) {
      return {
        ok: false,
        pipelineEstado: "rechazado",
        fragments: [],
        publicaAK: false,
        motivoRechazo: "adjunto_no_soportado",
      };
    }

    const publicaAK = input.origen === "biblioteca_k";
    const prefix =
      input.keyPrefix ??
      (publicaAK
        ? STORAGE_PREFIXES.conocimiento
        : STORAGE_PREFIXES.adjuntoCanal);
    const checksum = createHash("sha256").update(input.buffer).digest("hex");
    const storageKey = `${prefix}/${randomUUID()}/${input.nombreArchivo ?? tipo}`;

    let putKey: string;
    let putBucket: string | undefined;
    try {
      const put = await this.storage.put({
        key: storageKey,
        body: input.buffer,
        contentType: input.mime,
      });
      putKey = put.key;
      putBucket = put.bucket;
    } catch (err) {
      this.logger.error(`storage put failed: ${String(err)}`);
      return {
        ok: false,
        pipelineEstado: "error",
        fragments: [],
        publicaAK: false,
        errorTipificado: "storage_put_failed",
        motivoRechazo: "storage_put_failed",
      };
    }

    try {
      let signedUrl: string | undefined;
      try {
        signedUrl = await this.storage.signedUrl({
          key: putKey,
          expiresInSec: 300,
        });
      } catch {
        signedUrl = undefined;
      }

      const parsed = await plugin.parse({
        buffer: input.buffer,
        mime: input.mime,
        nombreArchivo: input.nombreArchivo,
        storageKey: putKey,
        signedUrl,
        duracionMs: input.duracionMs,
      });

      let result: MediaRouteResult;
      if (parsed.kind === "rejected") {
        result = {
          ok: false,
          pipelineEstado: "rechazado",
          storageKey: putKey,
          storageBucket: putBucket,
          checksum,
          bytes: input.buffer.length,
          fragments: [],
          publicaAK: false,
          motivoRechazo: parsed.motivo,
        };
      } else if (parsed.kind === "catalogo") {
        result = {
          ok: true,
          pipelineEstado: "listo",
          storageKey: putKey,
          storageBucket: putBucket,
          checksum,
          bytes: input.buffer.length,
          fragments: [],
          publicaAK: false,
          catalogoSnapshot: parsed.catalogoRows,
        };
      } else {
        result = {
          ok: true,
          pipelineEstado: "listo",
          storageKey: putKey,
          storageBucket: putBucket,
          checksum,
          bytes: input.buffer.length,
          fragments: parsed.fragments,
          publicaAK,
        };
      }

      const slaMs = Date.now() - started;
      result.slaMs = slaMs;
      this.sla.record(tipo, slaMs, checksum);
      if (input.origen === "adjunto_canal") {
        result.publicaAK = false;
      }
      return result;
    } catch (err) {
      this.logger.error(`media route failed: ${String(err)}`);
      return {
        ok: false,
        pipelineEstado: "error",
        storageKey: putKey,
        storageBucket: putBucket,
        checksum,
        bytes: input.buffer.length,
        fragments: [],
        publicaAK: false,
        errorTipificado: "proveedor_ia",
        motivoRechazo: "proveedor_ia",
        slaMs: Date.now() - started,
      };
    }
  }

  private checkSize(tipo: TipoMaterial, bytes: number): string | null {
    const mb = bytes / (1024 * 1024);
    if ((tipo === "pdf" || tipo === "docx") && mb > MEDIA_LIMITS.pdfWordMb) {
      return "archivo_demasiado_grande";
    }
    if ((tipo === "xlsx" || tipo === "csv") && mb > MEDIA_LIMITS.excelMb) {
      return "archivo_demasiado_grande";
    }
    if (tipo === "imagen" && mb > MEDIA_LIMITS.fotoMb) {
      return "archivo_demasiado_grande";
    }
    if (tipo === "video" && mb > MEDIA_LIMITS.videoMb) {
      return "archivo_demasiado_grande";
    }
    return null;
  }

  slaBudgetMs(tipo: TipoMaterial): number {
    if (tipo === "imagen") return SLA_MS.foto;
    if (tipo === "video") return SLA_MS.video;
    return SLA_MS.texto;
  }
}
