import { Injectable, Logger } from "@nestjs/common";
import type { TurnHandler } from "./turn-handler";
import type { InboundMessage, TurnResult } from "./types/inbound-message";

/**
 * Stub hasta que exista OrchestratorService.handleTurn.
 * Documentado en apps/api/docs/fase-e-f-wiring.md
 */
@Injectable()
export class StubTurnHandler implements TurnHandler {
  private readonly logger = new Logger(StubTurnHandler.name);

  async handleTurn(message: InboundMessage): Promise<TurnResult> {
    this.logger.warn(
      `StubTurnHandler: orquestador no cableado (msg=${message.externalMessageId})`,
    );
    return {
      textoRespuesta:
        "Gracias por tu mensaje. Un asesor te atenderá en breve.",
      ruta: "safe",
      estadoBot: "activo",
      motivoHandoff: null,
    };
  }
}
