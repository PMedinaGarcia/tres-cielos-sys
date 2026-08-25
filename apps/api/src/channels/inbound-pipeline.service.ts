import { Inject, Injectable, Logger } from "@nestjs/common";
import { TURN_HANDLER, type TurnHandler } from "./turn-handler";
import { IdempotencyService } from "./idempotency.service";
import { OutboundService } from "./outbound.service";
import { ConversationStateStore } from "./conversation-state.store";
import { ChannelAttachmentService } from "./attachments/channel-attachment.service";
import { AuditService } from "../audit/audit.service";
import { QuotaService } from "../quota/quota.service";
import { CrmCalificacionService } from "../crm/calificacion.service";
import { NotificationsService } from "../notifications/notifications.service";
import { AssignmentService } from "../assignment/assignment.service";
import type { InboundMessage, TurnResult } from "./types/inbound-message";

/**
 * Pipeline post-ACK: idempotencia → cupo → estado_bot → adjuntos async → turn → outbound.
 * Bot silencio si estado_bot ∈ {humano, escalado} según política (D-BOT-6: humano).
 */
@Injectable()
export class InboundPipelineService {
  private readonly logger = new Logger(InboundPipelineService.name);

  constructor(
    private readonly idempotency: IdempotencyService,
    private readonly outbound: OutboundService,
    private readonly conversations: ConversationStateStore,
    private readonly attachments: ChannelAttachmentService,
    private readonly audit: AuditService,
    private readonly quota: QuotaService,
    private readonly crm: CrmCalificacionService,
    private readonly notifications: NotificationsService,
    private readonly assignment: AssignmentService,
    @Inject(TURN_HANDLER) private readonly turnHandler: TurnHandler,
  ) {}

  async process(message: InboundMessage): Promise<TurnResult | { duplicate: true }> {
    if (!this.idempotency.tryClaim(message.canal, message.externalMessageId)) {
      this.logger.debug(`duplicate ${message.externalMessageId}`);
      return { duplicate: true };
    }

    const conv = this.conversations.getOrCreate(
      message.canal,
      message.externalThreadId,
    );

    // F3 soft/hard cupo
    const cupo = this.quota.consumeMessaging(conv.sedeId ?? "default");
    if (cupo.hardBlocked) {
      const safe: TurnResult = {
        conversacionId: conv.id,
        textoRespuesta:
          "En este momento no podemos continuar por límite de uso. Un asesor te contactará.",
        ruta: "handoff",
        estadoBot: "escalado",
        motivoHandoff: "cupo_ia",
      };
      conv.estadoBot = "escalado";
      await this.notifications.notifyEscalacion({
        conversacionId: conv.id,
        motivo: "cupo_ia",
        ventanaMinutos: 15,
      });
      await this.audit.record({
        tipo: "bot_handoff",
        actor: "bot",
        conversacionId: conv.id,
        payload: { motivoHandoff: "cupo_ia", cupo },
      });
      await this.sendOutbound(message, safe.textoRespuesta);
      return safe;
    }

    // D-BOT-6: humano → silencio (sin LLM / sin reply bot)
    if (conv.estadoBot === "humano") {
      await this.audit.record({
        tipo: "bot_decision",
        actor: "bot",
        conversacionId: conv.id,
        payload: { ruta: "silencio", estadoBot: "humano" },
      });
      return {
        conversacionId: conv.id,
        textoRespuesta: "",
        ruta: "silencio",
        estadoBot: "humano",
        silencio: true,
      };
    }

    // Adjuntos: storage + job; no bloquea ACK (ya hecho); no publica K
    if (message.adjuntos?.length) {
      void this.attachments
        .ingestInboundAttachments({
          mensajeId: message.externalMessageId,
          conversacionId: conv.id,
          adjuntos: message.adjuntos,
        })
        .catch((e) => this.logger.error(String(e)));
    }

    // Soft cupo IA pre-turn
    const ia = this.quota.checkAi(conv.sedeId ?? "default");
    if (ia.hardBlocked) {
      const safe: TurnResult = {
        conversacionId: conv.id,
        textoRespuesta:
          "Estamos con alta demanda de asistencia automática. Un asesor te atenderá pronto.",
        ruta: "handoff",
        estadoBot: "escalado",
        motivoHandoff: "cupo_ia",
      };
      conv.estadoBot = "escalado";
      await this.finishHandoff(message, conv.id, safe, "cupo_ia");
      return safe;
    }

    let result: TurnResult;
    try {
      result = await this.turnHandler.handleTurn(message);
    } catch (err) {
      this.logger.error(`turn failed: ${String(err)}`);
      result = {
        conversacionId: conv.id,
        textoRespuesta:
          "Tuvimos un problema técnico. Un asesor te contactará.",
        ruta: "handoff",
        estadoBot: "escalado",
        motivoHandoff: "proveedor_ia",
      };
    }

    result.conversacionId = result.conversacionId ?? conv.id;
    this.quota.consumeAiTokens(conv.sedeId ?? "default", 500);

    if (result.estadoBot === "escalado" || result.ruta === "handoff") {
      conv.estadoBot = "escalado";
      await this.finishHandoff(
        message,
        conv.id,
        result,
        result.motivoHandoff ?? "otro",
      );
      return result;
    }

    // F4 calificación post-turno (brief stub desde meta)
    const cal = this.crm.evaluarTrasTurno({
      conversacionId: conv.id,
      oportunidadId: conv.oportunidadId,
      sedeId: conv.sedeId,
    });
    if (cal.listoParaCotizar || cal.calificacion === "calificado") {
      const assigned = this.assignment.assign({
        sedeId: conv.sedeId ?? "sede-default",
        oportunidadId: cal.oportunidadId,
      });
      conv.asesorId = assigned.asesorId;
      await this.notifications.notifyCalificado({
        conversacionId: conv.id,
        oportunidadId: cal.oportunidadId,
        asesorId: assigned.asesorId,
        listoParaCotizar: cal.listoParaCotizar,
      });
    }

    if (!result.silencio && result.textoRespuesta) {
      await this.sendOutbound(message, result.textoRespuesta);
      await this.audit.record({
        tipo: "bot_mensaje_saliente",
        actor: "bot",
        conversacionId: conv.id,
        payload: {
          ruta: result.ruta,
          cupo: this.quota.snapshot(conv.sedeId ?? "default"),
        },
      });
    }

    return result;
  }

  private async finishHandoff(
    message: InboundMessage,
    conversacionId: string,
    result: TurnResult,
    motivo: string,
  ): Promise<void> {
    const conv = this.conversations.getById(conversacionId);
    const assigned = this.assignment.assign({
      sedeId: conv?.sedeId ?? "sede-default",
      oportunidadId: conv?.oportunidadId,
      motivoEscalacion: motivo,
    });
    if (conv) conv.asesorId = assigned.asesorId;

    await this.notifications.notifyEscalacion({
      conversacionId,
      motivo,
      ventanaMinutos: 20,
      asesorId: assigned.asesorId,
    });
    await this.audit.record({
      tipo: "bot_handoff",
      actor: "bot",
      conversacionId,
      payload: { motivoHandoff: motivo, asesorId: assigned.asesorId },
    });
    if (result.textoRespuesta) {
      await this.sendOutbound(message, result.textoRespuesta);
    }
  }

  private async sendOutbound(
    message: InboundMessage,
    texto: string,
  ): Promise<void> {
    if (message.meta?.sandbox === true) return;
    await this.outbound.send({
      canal: message.canal,
      externalThreadId: message.externalThreadId,
      texto,
      inReplyToExternalMessageId: message.externalMessageId,
    });
  }
}
