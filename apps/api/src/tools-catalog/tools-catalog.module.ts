import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { CatalogToolsService } from "./catalog-tools.service";
import { RegistroConsultaCatalogoService } from "./registro-consulta-catalogo.service";
import { ToolsExecutorService } from "./tools-executor.service";

@Module({
  imports: [PrismaModule],
  providers: [
    CatalogToolsService,
    RegistroConsultaCatalogoService,
    ToolsExecutorService,
  ],
  exports: [
    CatalogToolsService,
    RegistroConsultaCatalogoService,
    ToolsExecutorService,
  ],
})
export class ToolsCatalogModule {}
