import { Inject, Injectable, Module, OnModuleInit } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AiProvidersModule } from "../ai-providers/ai-providers.module";
import { FragmentRepository } from "./fragment.repository";
import { buildKnowledgeFixtures } from "./fixtures/knowledge-fixtures";
import { GeneratorService } from "./generator.service";
import { HybridSearchService } from "./hybrid-search.service";
import { InMemoryFragmentRepository } from "./in-memory-fragment.repository";
import { RagPipelineService } from "./rag-pipeline.service";
import { RegistroRecuperacionService } from "./registro-recuperacion.service";
import { RerankService } from "./rerank.service";
import { FRAGMENT_REPOSITORY } from "./tokens";
import { CorpusInventoryService } from "./corpus/corpus-inventory.service";

/**
 * Carga fixtures K01/K02/K08/K09 al boot (D5).
 * Idempotente: replaceAll sobre el repositorio in-memory.
 */
@Injectable()
export class RagKnowledgeSeedService implements OnModuleInit {
  constructor(
    @Inject(FRAGMENT_REPOSITORY) private readonly fragments: FragmentRepository,
  ) {}

  onModuleInit(): void {
    this.fragments.replaceAll(buildKnowledgeFixtures());
  }
}

/**
 * RagPipelineModule — Fase D.
 *
 * Ports LLM / Embeddings / Rerank: importados desde AiProvidersModule (Fase A).
 * Fragmentos: InMemoryFragmentRepository hasta Prisma `FragmentoVectorial`.
 */
@Module({
  imports: [ConfigModule, AiProvidersModule],
  providers: [
    { provide: FRAGMENT_REPOSITORY, useClass: InMemoryFragmentRepository },
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
