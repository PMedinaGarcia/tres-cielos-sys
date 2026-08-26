import { Inject, Injectable, Module, OnModuleInit } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AiProvidersModule } from "../ai-providers/ai-providers.module";
import { resolveRagStore } from "../config/ai-mode";
import { PrismaService } from "../prisma/prisma.service";
import { FragmentRepository } from "./fragment.repository";
import { buildKnowledgeFixtures } from "./fixtures/knowledge-fixtures";
import { GeneratorService } from "./generator.service";
import { HybridSearchService } from "./hybrid-search.service";
import { InMemoryFragmentRepository } from "./in-memory-fragment.repository";
import { PrismaFragmentRepository } from "./prisma-fragment.repository";
import { RagPipelineService } from "./rag-pipeline.service";
import { RegistroRecuperacionService } from "./registro-recuperacion.service";
import { RerankService } from "./rerank.service";
import { FRAGMENT_REPOSITORY } from "./tokens";
import { CorpusInventoryService } from "./corpus/corpus-inventory.service";

/**
 * Carga fixtures K01/K02/K08/K09 al boot cuando el store es in-memory.
 * En prisma el seed vive en KnowledgeCorpusSeedService.
 */
@Injectable()
export class RagKnowledgeSeedService implements OnModuleInit {
  constructor(
    @Inject(FRAGMENT_REPOSITORY) private readonly fragments: FragmentRepository,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    if (resolveRagStore(this.config) === "prisma") return;
    this.fragments.replaceAll(buildKnowledgeFixtures());
  }
}

@Module({
  imports: [ConfigModule, AiProvidersModule],
  providers: [
    {
      provide: FRAGMENT_REPOSITORY,
      inject: [ConfigService, PrismaService],
      useFactory: (config: ConfigService, prisma: PrismaService) => {
        if (resolveRagStore(config) === "prisma") {
          return new PrismaFragmentRepository(prisma);
        }
        return new InMemoryFragmentRepository();
      },
    },
    HybridSearchService,
    RerankService,
    GeneratorService,
    RegistroRecuperacionService,
    RagPipelineService,
    CorpusInventoryService,
    RagKnowledgeSeedService,
  ],
  exports: [
    RagPipelineService,
    FRAGMENT_REPOSITORY,
    RegistroRecuperacionService,
    RerankService,
    HybridSearchService,
    GeneratorService,
    CorpusInventoryService,
  ],
})
export class RagPipelineModule {}
