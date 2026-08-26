import {
  Body,
  Controller,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ConversationStateStore } from "./conversation-state.store";
import { AuditService } from "../audit/audit.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { PanelUser } from "../auth/auth.types";
import { ExpedientePersistService } from "../crm/expediente-persist.service";

/**
 * F6 — Tomar control panel: estado_bot=humano; bot silencio (D-BOT-6).
 */
@Controller("conversaciones")
@UseGuards(JwtAuthGuard)
export class ConversationPanelController {
  constructor(
    private readonly conversations: ConversationStateStore,
    private readonly audit: AuditService,
    private readonly expediente: ExpedientePersistService,
  ) {}

  @Post(":id/tomar-control")
  @HttpCode(200)
  async tomarControl(
    @Param("id") id: string,
    @Body() body: { motivo?: string },
    @CurrentUser() user: PanelUser,
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
        usuarioId: user.userId,
        motivo: body.motivo ?? null,
      },
    });
    await this.expediente.persistTomaControl({
      conversacionId: id,
      usuarioId: user.userId,
      motivo: body.motivo ?? null,
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
    return {
      error: {
        code: "DEVOLUCION_BOT_DESHABILITADA",
        message: "Política v1: devolver a bot deshabilitado",
      },
    };
  }
}
