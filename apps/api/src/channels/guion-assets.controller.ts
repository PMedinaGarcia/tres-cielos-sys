import {
  Controller,
  Get,
  Header,
  Inject,
  NotFoundException,
  Param,
  StreamableFile,
} from "@nestjs/common";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { Public } from "../common/public.decorator";
import {
  GUION_PAQUETE_CARD_SLUGS,
  GUION_PDF_FILENAME,
  type GuionPaqueteCardSlug,
} from "@tres-cielos/shared";
import { GuionAssetsService } from "./guion-assets.service";
import { resolvePaqueteCardPath } from "./guion-assets";

@Controller("public/guion")
export class GuionAssetsController {
  constructor(
    @Inject(GuionAssetsService) private readonly guion: GuionAssetsService,
  ) {}

  @Public()
  @Get("paquete-bodas-2027.pdf")
  @Header("Content-Type", "application/pdf")
  @Header(
    "Content-Disposition",
    `inline; filename="${GUION_PDF_FILENAME}"`,
  )
  async paqueteBodas2027(): Promise<StreamableFile> {
    const file = await this.guion.loadPdfBytes();
    if (!file) {
      throw new NotFoundException("Ficha Paquete Bodas 2027 no encontrada");
    }
    return new StreamableFile(file.body, {
      type: file.contentType,
    });
  }

  @Public()
  @Get("cards/:slug.svg")
  @Header("Content-Type", "image/svg+xml")
  async paqueteCard(
    @Param("slug") slug: string,
  ): Promise<StreamableFile> {
    const key = slug.replace(/\.svg$/i, "") as GuionPaqueteCardSlug;
    if (!GUION_PAQUETE_CARD_SLUGS.includes(key)) {
      throw new NotFoundException("Card de paquete no encontrada");
    }
    const path = resolvePaqueteCardPath(key);
    if (!existsSync(path)) {
      throw new NotFoundException("Card de paquete no encontrada");
    }
    const body = await readFile(path);
    return new StreamableFile(body, { type: "image/svg+xml" });
  }
}
