import { Global, Module } from "@nestjs/common";
import { ConversationStoreService } from "./conversation-store.service";
import { AuditEventoService } from "./audit-evento.service";
import { CrmBriefStubService } from "./crm-brief.stub";
import { QuotaStubService } from "./quota.stub";
import { RAG_PIPELINE_PORT } from "./rag-pipeline.port";
import { StubRagPipeline } from "./stub-rag-pipeline";

@Global()
@Module({
  providers: [
    ConversationStoreService,
    AuditEventoService,
    CrmBriefStubService,
    QuotaStubService,
    { provide: RAG_PIPELINE_PORT, useClass: StubRagPipeline },
  ],
  exports: [
    ConversationStoreService,
    AuditEventoService,
    CrmBriefStubService,
    QuotaStubService,
    RAG_PIPELINE_PORT,
  ],
})
export class ConversationStubsModule {}
