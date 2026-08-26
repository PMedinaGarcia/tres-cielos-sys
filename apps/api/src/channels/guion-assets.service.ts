import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { readFile } from "fs/promises";
import {
  GUION_PDF_FILENAME,
  type WaDocument,
} from "@tres-cielos/shared";
import { OBJECT_STORAGE_PORT } from "../ports/tokens";
import type { ObjectStoragePort } from "../ports/object-storage.port";
import {
  GUION_SIGNED_URL_TTL_SEC,
  STORAGE_KEYS,
} from "../ports/storage-prefixes";
import { isObjectStorageLive } from "../config/ai-mode";
import {
  paqueteBodas2027Document,
  paqueteBodasPdfExists,
  resolvePaqueteBodasPdfPath,
} from "./guion-assets";

@Injectable()
export class GuionAssetsService implements OnModuleInit {
  private readonly logger = new Logger(GuionAssetsService.name);

  constructor(
    @Inject(OBJECT_STORAGE_PORT) private readonly storage: ObjectStoragePort,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureUploaded();
  }

  async ensureUploaded(): Promise<void> {
    if (!isObjectStorageLive(this.config)) return;
    if (!paqueteBodasPdfExists()) {
      this.logger.warn("PDF guion local no encontrado; no se sube a S3");
      return;
    }
    try {
      if (await this.storage.exists(STORAGE_KEYS.guionPaqueteBodas)) return;
      const body = await readFile(resolvePaqueteBodasPdfPath());
      await this.storage.put({
        key: STORAGE_KEYS.guionPaqueteBodas,
        body,
        contentType: "application/pdf",
      });
      this.logger.log(`subido ${STORAGE_KEYS.guionPaqueteBodas}`);
    } catch (err) {
      this.logger.warn(`no se pudo subir PDF guion: ${String(err)}`);
    }
  }

  async resolveDocument(): Promise<WaDocument> {
    if (isObjectStorageLive(this.config)) {
      try {
        const url = await this.storage.signedUrl({
          key: STORAGE_KEYS.guionPaqueteBodas,
          expiresInSec: GUION_SIGNED_URL_TTL_SEC,
        });
        return {
          filename: GUION_PDF_FILENAME,
          mime: "application/pdf",
          url,
        };
      } catch (err) {
        this.logger.warn(`signed URL guion falló: ${String(err)}`);
      }
    }
    return paqueteBodas2027Document();
  }

  async loadPdfBytes(): Promise<{ body: Buffer; contentType: string } | null> {
    if (isObjectStorageLive(this.config)) {
      try {
        const got = await this.storage.get(STORAGE_KEYS.guionPaqueteBodas);
        return { body: got.body, contentType: got.contentType ?? "application/pdf" };
      } catch {
        this.logger.warn("PDF guion no está en object storage; fallback disco");
      }
    }
    if (!paqueteBodasPdfExists()) return null;
    const body = await readFile(resolvePaqueteBodasPdfPath());
    return { body, contentType: "application/pdf" };
  }
}
