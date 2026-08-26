/**
 * Adapter opcional: OrchestratorService → TURN_HANDLER.
 * No importa conversation/ en ChannelsModule por defecto (evita ciclo).
 * Cablear en AppModule cuando ConversationOrchestratorModule exista:
 *
 *   import { OrchestratorTurnAdapter } from "./channels/orchestrator-turn.adapter";
 *   import { OrchestratorService } from "./conversation/orchestrator/orchestrator.service";
 *   import { TURN_HANDLER } from "./channels/turn-handler";
 *
 *   providers: [
 *     {
 *       provide: TURN_HANDLER,
 *       useFactory: (orch: OrchestratorService) => new OrchestratorTurnAdapter(orch),
 *       inject: [OrchestratorService],
 *     },
 *   ]
 */
import type { TurnHandler } from "./turn-handler";
import type {
  InboundMessage,
  TurnResult,
} from "./types/inbound-message";

export interface OrchestratorLike {
  handleTurn(inbound: {
    canal: string;
    externalThreadId: string;
    externalMessageId: string;
    texto: string;
    recibidoEn: string;
    perfilCanal?: InboundMessage["perfilCanal"];
    buttonPayload?: string;
    adjuntos?: Array<{
      mimeType: string;
      sizeBytes?: number;
      storageKey?: string;
    }>;
  }): Promise<{
    conversacionId?: string;
    textoRespuesta: string;
    ruta: string;
    estadoBot: string;
    motivoHandoff?: string | null;
    eventoOperativoId?: string | null;
    reasoningTraceId?: string | null;
    reasoningTrace?: TurnResult["reasoningTrace"];
    registroRecuperacionId?: string | null;
    registroConsultaCatalogoId?: string | null;
    pasoGuion?: string;
    waContent?: TurnResult["waContent"];
  }>;
}

export class OrchestratorTurnAdapter implements TurnHandler {
  constructor(private readonly orchestrator: OrchestratorLike) {}

  async handleTurn(message: InboundMessage): Promise<TurnResult> {
    const canal =
      message.canal === "facebook" ? "messenger" : message.canal;
    const res = await this.orchestrator.handleTurn({
      canal,
      externalThreadId: message.externalThreadId,
      externalMessageId: message.externalMessageId,
      texto: message.texto,
      recibidoEn: message.recibidoEn,
      perfilCanal: message.perfilCanal,
      buttonPayload: message.buttonPayload,
      adjuntos: message.adjuntos?.map((a) => ({
        mimeType: a.mime,
        sizeBytes: a.bytes,
        storageKey: a.storageKey,
      })),
    });
    return {
      conversacionId: res.conversacionId,
      textoRespuesta: res.textoRespuesta ?? "",
      ruta: res.ruta as TurnResult["ruta"],
      estadoBot: res.estadoBot as TurnResult["estadoBot"],
      motivoHandoff: res.motivoHandoff ?? null,
      eventoOperativoId: res.eventoOperativoId ?? undefined,
      silencio: res.ruta === "silencio" || !res.textoRespuesta,
      reasoningTraceId: res.reasoningTraceId ?? null,
      reasoningTrace: res.reasoningTrace ?? null,
      registroRecuperacionId: res.registroRecuperacionId ?? null,
      registroConsultaCatalogoId: res.registroConsultaCatalogoId ?? null,
      pasoGuion: res.pasoGuion,
      waContent: res.waContent ?? null,
    };
  }
}
