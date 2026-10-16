import {
  Body,
  Controller,
  HttpCode,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { PanelUser } from "../auth/auth.types";
import { BandejaAttachmentsService } from "./bandeja-attachments.service";

@Controller("conversaciones/:conversacionId/adjuntos")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("asesor", "coordinador", "admin")
export class BandejaAttachmentsController {
  constructor(private readonly adjuntos: BandejaAttachmentsService) {}

  @Post("preparar")
  @HttpCode(200)
  preparar(
    @Param("conversacionId") conversacionId: string,
    @Body() body: unknown,
    @CurrentUser() user: PanelUser,
  ) {
    return this.adjuntos.preparar(conversacionId, body, user);
  }

  @Post(":uploadId/completar")
  @HttpCode(200)
  completarPut(
    @Param("conversacionId") conversacionId: string,
    @Param("uploadId") uploadId: string,
    @CurrentUser() user: PanelUser,
  ) {
    return this.adjuntos.completarPut(conversacionId, uploadId, user);
  }

  @Post(":uploadId/completar-multipart")
  @HttpCode(200)
  completarMultipart(
    @Param("conversacionId") conversacionId: string,
    @Param("uploadId") uploadId: string,
    @Body() body: unknown,
    @CurrentUser() user: PanelUser,
  ) {
    return this.adjuntos.completarMultipart(
      conversacionId,
      uploadId,
      body,
      user,
    );
  }

  /** Subida directa cuando el storage es fake/local (URL firmada no usable desde el browser). */
  @Put(":uploadId/binario")
  @HttpCode(200)
  async subirBinario(
    @Param("conversacionId") conversacionId: string,
    @Param("uploadId") uploadId: string,
    @Req() req: Request & { rawBody?: Buffer },
    @CurrentUser() user: PanelUser,
  ) {
    const body = req.rawBody ?? Buffer.alloc(0);
    return this.adjuntos.escribirBinario(
      conversacionId,
      uploadId,
      body,
      user,
    );
  }
}
