import { Module } from "@nestjs/common";
import { ToolsCatalogModule } from "../tools-catalog/tools-catalog.module";
import { CatalogSandboxController } from "./catalog-sandbox.controller";
import { CatalogParserService } from "./catalog-parser.service";
import { CatalogSeedService } from "./catalog-seed.service";

/**
 * Legacy sandbox HTTP — tools delegan en ToolsCatalogModule.
 * Controllers de eval/seed se mantienen; CatalogToolsService ya no se redefine aquí.
 */
@Module({
  imports: [ToolsCatalogModule],
  controllers: [CatalogSandboxController],
  providers: [CatalogParserService, CatalogSeedService],
  exports: [CatalogParserService, CatalogSeedService, ToolsCatalogModule],
})
export class CatalogSandboxModule {}
