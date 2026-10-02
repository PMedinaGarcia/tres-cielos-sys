import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { readFile } from "fs/promises";
import { GUION_FLUJO_PDFS, type WaDocument } from "@tres-cielos/shared";
import { existsSync } from "fs";
import { join } from "path";
import { OBJECT_STORAGE_PORT } from "../ports/tokens";
import type { ObjectStoragePort } from "../ports/object-storage.port";
import {
  GUION_SIGNED_URL_TTL_SEC,
  guionPdfStorageKey,
} from "../ports/storage-prefixes";
import { isObjectStorageLive } from "../config/ai-mode";
import { guionFlujoDocuments } from "./guion-assets";

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
    for (const pdf of GUION_FLUJO_PDFS) {
      const path = join(process.cwd(), "assets", "guion", `${pdf.slug}.pdf`);
      const key = guionPdfStorageKey(pdf.slug);
      if (!existsSync(path)) {
        this.logger.warn(`PDF guion local no encontrado (${pdf.slug}); no se sube`);
        continue;
      }
      try {
        if (await this.storage.exists(key)) continue;
        const body = await readFile(path);
        await this.storage.put({
          key,
          body,
          contentType: "application/pdf",
        });
        this.logger.log(`subido ${key}`);
      } catch (err) {
        this.logger.warn(`no se pudo subir ${key}: ${String(err)}`);
      }
    }
  }

  async resolveDocuments(): Promise<WaDocument[]> {
    if (isObjectStorageLive(this.config)) {
      try {
        return await Promise.all(
          GUION_FLUJO_PDFS.map(async (pdf) => ({
            filename: pdf.filename,
            mime: "application/pdf" as const,
            url: await this.storage.signedUrl({
              key: guionPdfStorageKey(pdf.slug),
              expiresInSec: GUION_SIGNED_URL_TTL_SEC,
            }),
          })),
        );
      } catch (err) {
        this.logger.warn(`signed URL guion falló: ${String(err)}`);
      }
    }
    return guionFlujoDocuments();
  }

  async loadPdfBytes(
    slug: string,
  ): Promise<{ body: Buffer; contentType: string } | null> {
    const key = guionPdfStorageKey(slug);
    if (isObjectStorageLive(this.config)) {
      try {
        const got = await this.storage.get(key);
        return { body: got.body, contentType: got.contentType ?? "application/pdf" };
      } catch {
        this.logger.warn(`PDF ${slug} no está en object storage; fallback disco`);
      }
    }
    const path = join(process.cwd(), "assets", "guion", `${slug}.pdf`);
    if (!existsSync(path)) return null;
    const body = await readFile(path);
    return { body, contentType: "application/pdf" };
  }
}
