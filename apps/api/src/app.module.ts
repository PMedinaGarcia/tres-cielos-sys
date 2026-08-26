import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AiProvidersModule } from "./ai-providers/ai-providers.module";
import { CatalogSandboxModule } from "./catalog-sandbox/catalog-sandbox.module";
import { configuration, validateEnv } from "./config";
import { HealthModule } from "./health/health.module";
import { PrismaModule } from "./prisma/prisma.module";
import { RagPipelineModule } from "./rag/rag-pipeline.module";
import { ToolsCatalogModule } from "./tools-catalog/tools-catalog.module";
import { ScriptModule } from "./conversation/script/script.module";
import { HandoffModule } from "./conversation/handoff/handoff.module";
import { ConversationOrchestratorModule } from "./conversation/orchestrator/conversation-orchestrator.module";
import { ChannelsModule } from "./channels/channels.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { CrmModule } from "./crm/crm.module";
import { KnowledgeIngestionModule } from "./knowledge-ingestion/knowledge-ingestion.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "../../.env"],
      load: [configuration],
      validate: validateEnv,
    }),
    PrismaModule,
    AiProvidersModule,
    HealthModule,
    CatalogSandboxModule,
    ToolsCatalogModule,
    ScriptModule,
    HandoffModule,
    ConversationOrchestratorModule,
    RagPipelineModule,
    ChannelsModule,
    AuthModule,
    UsersModule,
    CrmModule,
    KnowledgeIngestionModule,
  ],
})
export class AppModule {}
