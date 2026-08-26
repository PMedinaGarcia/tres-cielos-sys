import { Module } from "@nestjs/common";
import { KnowledgeIngestionModule } from "../knowledge-ingestion/knowledge-ingestion.module";
import { AuditModule } from "../audit/audit.module";
import { QuotaModule } from "../quota/quota.module";
import { CrmModule } from "../crm/crm.module";
import { AssignmentModule } from "../assignment/assignment.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { ConversationOrchestratorModule } from "../conversation/orchestrator/conversation-orchestrator.module";
import { ReasoningModule } from "../conversation/reasoning/reasoning.module";
import { OrchestratorService } from "../conversation/orchestrator/orchestrator.service";
import { MetaWebhookController } from "./meta.webhook.controller";
import { TwilioWebhookController } from "./twilio.webhook.controller";
import { ConversationPanelController } from "./conversation-panel.controller";
import { ChannelSandboxController } from "./channel-sandbox.controller";
import { GuionAssetsController } from "./guion-assets.controller";
import { MessageNormalizerService } from "./message-normalizer.service";
import { OutboundService } from "./outbound.service";
import { IdempotencyService } from "./idempotency.service";
import { ConversationStateStore } from "./conversation-state.store";
import { ChannelAttachmentService } from "./attachments/channel-attachment.service";
import { InboundPipelineService } from "./inbound-pipeline.service";
import { GuionAssetsService } from "./guion-assets.service";
import { MetaSignatureGuard } from "./guards/meta-signature.guard";
import { TwilioSignatureGuard } from "./guards/twilio-signature.guard";
import { TURN_HANDLER } from "./turn-handler";
import { OrchestratorTurnAdapter } from "./orchestrator-turn.adapter";
import { TurnSandboxGuard } from "../conversation/orchestrator/turn.controller";
import { AuthModule } from "../auth/auth.module";

/**
 * ChannelsModule — Fase F.
 * TURN_HANDLER → OrchestratorTurnAdapter (mismo cerebro que POST /orchestrator/turn).
 * Chat sandbox: POST /channels/sandbox/inbound → InboundPipelineService.process
 * (paridad con Twilio; el webhook solo añade firma + ACK async).
 */
@Module({
  imports: [
    KnowledgeIngestionModule,
    AuditModule,
    QuotaModule,
    CrmModule,
    AssignmentModule,
    NotificationsModule,
    ConversationOrchestratorModule,
    ReasoningModule,
    AuthModule,
  ],
  controllers: [
    MetaWebhookController,
    TwilioWebhookController,
    ConversationPanelController,
    ChannelSandboxController,
    GuionAssetsController,
  ],
  providers: [
    MessageNormalizerService,
    OutboundService,
    IdempotencyService,
    ConversationStateStore,
    ChannelAttachmentService,
    InboundPipelineService,
    GuionAssetsService,
    MetaSignatureGuard,
    TwilioSignatureGuard,
    TurnSandboxGuard,
    {
      provide: TURN_HANDLER,
      useFactory: (orch: OrchestratorService) =>
        new OrchestratorTurnAdapter(orch),
      inject: [OrchestratorService],
    },
  ],
  exports: [
    MessageNormalizerService,
    OutboundService,
    IdempotencyService,
    ConversationStateStore,
    InboundPipelineService,
    TURN_HANDLER,
  ],
})
export class ChannelsModule {}
