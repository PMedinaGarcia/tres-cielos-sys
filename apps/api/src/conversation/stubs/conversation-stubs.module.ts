import { Global, Module } from "@nestjs/common";
import { ConversationStoreService } from "./conversation-store.service";
import { AuditEventoService } from "./audit-evento.service";
import { CrmBriefStubService } from "./crm-brief.stub";
import { QuotaStubService } from "./quota.stub";
import { RAG_PIPELINE_PORT } from "./rag-pipeline.port";
import { StubRagPipeline } from "./stub-rag-pipeline";
import { NurtureWorkerService } from "../nurture/nurture.worker";
import { SlaClockService } from "../nurture/sla-clock.service";
import { ClienteMemoriaService } from "../memoria/cliente-memoria.service";

@Global()
@Module({
  providers: [
    ConversationStoreService,
    AuditEventoService,
    CrmBriefStubService,
    QuotaStubService,
    NurtureWorkerService,
    SlaClockService,
    ClienteMemoriaService,
    { provide: RAG_PIPELINE_PORT, useClass: StubRagPipeline },
  ],
  exports: [
    ConversationStoreService,
    AuditEventoService,
    CrmBriefStubService,
    QuotaStubService,
    NurtureWorkerService,
    SlaClockService,
    ClienteMemoriaService,
    RAG_PIPELINE_PORT,
  ],
})
export class ConversationStubsModule {}
