import {
  Controller,
  Get,
  Header,
  Inject,
  NotFoundException,
  StreamableFile,
} from "@nestjs/common";
import { Public } from "../common/public.decorator";
import { GUION_PDF_FILENAME } from "@tres-cielos/shared";
import { GuionAssetsService } from "./guion-assets.service";

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
}
