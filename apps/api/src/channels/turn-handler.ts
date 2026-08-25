import type { InboundMessage, TurnResult } from "./types/inbound-message";

/**
 * Contrato de cableado al ConversationOrchestrator (Fase B).
 * Channels inyecta TURN_HANDLER — si OrchestratorService no existe,
 * se usa StubTurnHandler hasta el wire.
 *
 * En ConversationOrchestratorModule:
 *   { provide: TURN_HANDLER, useExisting: OrchestratorService }
 * y OrchestratorService debe implementar TurnHandler.handleTurn.
 */
export const TURN_HANDLER = Symbol("TURN_HANDLER");

export interface TurnHandler {
  handleTurn(message: InboundMessage): Promise<TurnResult>;
}
