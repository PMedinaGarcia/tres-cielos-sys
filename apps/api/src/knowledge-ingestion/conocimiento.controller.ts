import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { PublishArchiveService } from "./jobs/publish-archive.service";
import { KNOWLEDGE_REPOSITORY } from "./repository/knowledge.repository";
import type { KnowledgeRepository } from "./repository/knowledge.repository";

class ArchiveBodyDto {
  documentoId!: string;
}

@Controller("conocimiento")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
export class ConocimientoController {
  constructor(
    private readonly publish: PublishArchiveService,
    @Inject(KNOWLEDGE_REPOSITORY) private readonly repo: KnowledgeRepository,
  ) {}

  @Get("documentos")
  async list() {
    const fragments = await this.repo.listActiveFragments();
    return { data: { fragments } };
  }

  @Post("documentos")
  @UseInterceptors(FileInterceptor("file"))
  async create(
    @UploadedFile() file: { buffer: Buffer; mimetype: string; originalname: string } | undefined,
    @Body()
    body: {
      titulo?: string;
      sedeId?: string;
      inventarioId?: string;
    },
  ) {
    if (!file?.buffer) {
      return {
        error: { code: "FILE_REQUIRED", message: "Falta el archivo multipart `file`" },
      };
    }
    const titulo = body.titulo?.trim() || file.originalname;
    const result = await this.publish.publish({
      titulo,
      mime: file.mimetype,
      buffer: file.buffer,
      nombreArchivo: file.originalname,
      sedeId: body.sedeId || undefined,
      inventarioId: body.inventarioId || undefined,
    });
    return { data: result };
  }

  @Post("documentos/:id/archivar")
  async archive(@Param("id") id: string) {
    const documento = await this.publish.archive(id);
    return { data: { documento } };
  }

  @Post("archivar")
  async archiveBody(@Body() body: ArchiveBodyDto) {
    const documento = await this.publish.archive(body.documentoId);
    return { data: { documento } };
  }
}
