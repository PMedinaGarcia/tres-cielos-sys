import {
  Body,
  Controller,
  HttpCode,
  NotFoundException,
  Param,
  Post,
} from "@nestjs/common";
import { ConversationStateStore } from "./conversation-state.store";
import { AuditService } from "../audit/audit.service";

/**
 * F6 — Tomar control panel stub: estado_bot=humano; bot silencio (D-BOT-6).
 * JWT Ownership real vive en auth/ (Fase aparte); aquí stub sin AuthGuard
 * para smoke interno. Proteger en prod con AuthGuard + OwnershipGuard.
 */
@Controller("conversaciones")
export class ConversationPanelController {
  constructor(
    private readonly conversations: ConversationStateStore,
    private readonly audit: AuditService,
  ) {}

  @Post(":id/tomar-control")
  @HttpCode(200)
  async tomarControl(
    @Param("id") id: string,
    @Body() body: { motivo?: string; usuarioId?: string },
  ) {
    const conv = this.conversations.getById(id);
    if (!conv) throw new NotFoundException("CONVERSACION_NOT_FOUND");
    const anterior = conv.estadoBot;
    this.conversations.setEstadoBot(id, "humano");
    const evento = await this.audit.record({
      tipo: "toma_control",
      actor: "asesor",
      conversacionId: id,
      payload: {
        estadoBotAnterior: anterior,
        estadoBotNuevo: "humano",
        usuarioId: body.usuarioId ?? "stub-asesor",
        motivo: body.motivo ?? null,
      },
    });
    return {
      id,
      estadoBot: "humano",
      eventoOperativoId: evento.id,
    };
  }

  @Post(":id/devolver-a-bot")
  @HttpCode(409)
  devolverABot() {
    // D-BOT-7 default v1 deshabilitado
    return {
      error: {
        code: "DEVOLUCION_BOT_DESHABILITADA",
        message: "Política v1: devolver a bot deshabilitado",
      },
    };
  }
}
