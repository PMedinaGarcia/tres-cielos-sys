export { RagPipelineModule } from "./rag-pipeline.module";
export { RagPipelineService } from "./rag-pipeline.service";
export { HybridSearchService } from "./hybrid-search.service";
export { RerankService, RerankProviderError } from "./rerank.service";
export { GeneratorService } from "./generator.service";
export { RegistroRecuperacionService } from "./registro-recuperacion.service";
export { InMemoryFragmentRepository } from "./in-memory-fragment.repository";
export { FRAGMENT_REPOSITORY } from "./tokens";
export type {
  RagAnswerContext,
  RagAnswerResult,
  RegistroRecuperacion,
  MotivoHandoffRag,
  FragmentoRecuperable,
} from "./types";
export {
  DEFAULT_RERANK_THRESHOLD,
  SAFE_COPY_K09,
} from "./types";
export {
  buildKnowledgeFixtures,
  FIXTURE_SEDE_JARDIN_1,
} from "./fixtures/knowledge-fixtures";
