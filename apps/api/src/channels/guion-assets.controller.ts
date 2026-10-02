import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  StreamableFile,
} from "@nestjs/common";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { Public } from "../common/public.decorator";
import {
  GUION_FLUJO_PDFS,
  GUION_PAQUETE_CARD_SLUGS,
  GUION_PDF_FILENAME,
  type GuionPaqueteCardSlug,
} from "@tres-cielos/shared";
import { GuionAssetsService } from "./guion-assets.service";
import { paqueteCardContentType, resolvePaqueteCardPath } from "./guion-assets";

@Controller("public/guion")
export class GuionAssetsController {
  constructor(
    @Inject(GuionAssetsService) private readonly guion: GuionAssetsService,
  ) {}

  @Public()
  @Get(":slug")
  async flujoPdf(@Param("slug") slug: string): Promise<StreamableFile> {
    if (!slug.toLowerCase().endsWith(".pdf")) {
      throw new NotFoundException("PDF del guion no encontrado");
    }
    const id = slug.replace(/\.pdf$/i, "");
    const known = GUION_FLUJO_PDFS.find((pdf) => pdf.slug === id);
    const legacy = id === "paquete-bodas-2027";
    if (!known && !legacy) {
      throw new NotFoundException("PDF del guion no encontrado");
    }
    const file = await this.guion.loadPdfBytes(id);
    if (!file) {
      throw new NotFoundException("PDF del guion no encontrado");
    }
    const downloadName = known?.filename ?? GUION_PDF_FILENAME;
    return new StreamableFile(file.body, {
      type: file.contentType,
      disposition: contentDispositionInline(downloadName),
    });
  }

  @Public()
  @Get("cards/:slug")
  async paqueteCard(
    @Param("slug") slug: string,
  ): Promise<StreamableFile> {
    const key = slug.replace(/\.(svg|jpe?g|webp|png)$/i, "") as GuionPaqueteCardSlug;
    if (!GUION_PAQUETE_CARD_SLUGS.includes(key)) {
      throw new NotFoundException("Card de paquete no encontrada");
    }
    const path = resolvePaqueteCardPath(key);
    if (!existsSync(path)) {
      throw new NotFoundException("Card de paquete no encontrada");
    }
    const body = await readFile(path);
    const type = paqueteCardContentType(path);
    return new StreamableFile(body, { type });
  }
}

function contentDispositionInline(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7E]/g, "_");
  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
