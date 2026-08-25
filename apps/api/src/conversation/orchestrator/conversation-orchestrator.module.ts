import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ToolsCatalogModule } from "../../tools-catalog/tools-catalog.module";
import { RagPipelineModule } from "../../rag/rag-pipeline.module";
import { TURN_HANDLER } from "../../channels/turn-handler";
import { LLM_PORT } from "../../ports/tokens";
import { OpenAiLlmAdapter } from "../../ai-providers/openai.llm.adapter";
import { CrmModule } from "../../crm/crm.module";
import { ScriptModule } from "../script/script.module";
import { HandoffModule } from "../handoff/handoff.module";
import { ConversationStubsModule } from "../stubs/conversation-stubs.module";
import { ReasoningModule } from "../reasoning/reasoning.module";
import { CatalogAwareLlmPort } from "../stubs/catalog-aware-llm.port";
import { OrchestratorService } from "./orchestrator.service";
import { IntentClassifierService } from "./intent-classifier.service";
import { TurnController, TurnSandboxGuard } from "./turn.controller";
import { RagPipelineAdapter } from "./rag-pipeline.adapter";
import { RAG_PIPELINE_PORT } from "../stubs/rag-pipeline.port";

@Module({
  imports: [
    ConfigModule,
    ConversationStubsModule,
    ScriptModule,
    HandoffModule,
    ToolsCatalogModule,
    RagPipelineModule,
    ReasoningModule,
    CrmModule,
  ],
  controllers: [TurnController],
  providers: [
    OrchestratorService,
    IntentClassifierService,
    TurnSandboxGuard,
    CatalogAwareLlmPort,
    RagPipelineAdapter,
    /**
     * fake/CI: planner heurístico de catálogo.
     * live: OpenAI (function calling + NLU).
     */
    {
      provide: LLM_PORT,
      inject: [ConfigService, CatalogAwareLlmPort],
      useFactory: (config: ConfigService, catalogAware: CatalogAwareLlmPort) => {
        const mode = config.get<string>("ai.providersMode") ?? "fake";
        if (mode === "live") {
          return new OpenAiLlmAdapter(config);
        }
        return catalogAware;
      },
    },
    { provide: RAG_PIPELINE_PORT, useExisting: RagPipelineAdapter },
    { provide: TURN_HANDLER, useExisting: OrchestratorService },
  ],
  exports: [
    OrchestratorService,
    TURN_HANDLER,
    TurnSandboxGuard,
  ],
})
export class ConversationOrchestratorModule {}
