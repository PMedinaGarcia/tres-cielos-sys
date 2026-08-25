/**
 * Smoke contract — shape del apéndice POST /orchestrator/turn.
 * Unit profundo vive en src/conversation/orchestrator/*.spec.ts
 */
import type { InboundMessage, TurnResponse } from "../src/conversation/types";

describe("orchestrator-turn contract (apéndice)", () => {
  it("InboundMessage / TurnResponse shapes", () => {
    const req: InboundMessage = {
      canal: "whatsapp",
      externalThreadId: "sandbox-thread-1",
      externalMessageId: "sandbox-msg-1",
      texto: "¿Cuánto cuesta el paquete BODA-J1-ESENCIAL?",
      recibidoEn: "2026-07-28T15:00:00.000Z",
      perfilCanal: { nombre: "QA", waId: "+520000000000" },
      adjuntos: [],
    };
    expect(req.canal).toBe("whatsapp");

    const data: TurnResponse = {
      conversacionId: "uuid",
      mensajeSalienteId: "uuid",
      textoRespuesta: "...",
      ruta: "catalogo",
      estadoBot: "activo",
      eventoOperativoId: "uuid",
    registroConsultaCatalogoId: "uuid",
    motivoHandoff: null,
    reasoningTraceId: "uuid",
    };
    expect(data.ruta).toBe("catalogo");
  });
});
