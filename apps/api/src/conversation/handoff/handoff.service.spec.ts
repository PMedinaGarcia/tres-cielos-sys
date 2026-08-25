import { HandoffService } from "./handoff.service";
import { ConversationStoreService } from "../stubs/conversation-store.service";
import { AuditEventoService } from "../stubs/audit-evento.service";
import { SAFE_COPY_HANDOFF_HUMANO, SAFE_COPY_K09 } from "./safe-copy";

describe("HandoffService (B3 / D-BOT-5)", () => {
  let store: ConversationStoreService;
  let audit: AuditEventoService;
  let handoff: HandoffService;

  beforeEach(() => {
    store = new ConversationStoreService();
    audit = new AuditEventoService();
    handoff = new HandoffService(store, audit);
  });

  it("escala a estado_bot=escalado + safe K09 + evento", async () => {
    const conv = await store.resolveOrCreate({
      canal: "whatsapp",
      externalThreadId: "t-1",
    });

    const result = await handoff.escalate({
      conversacionId: conv.id,
      motivo: "sin_catalogo",
      oportunidadId: conv.oportunidadId,
    });

    expect(result.estadoBot).toBe("escalado");
    expect(result.safeCopy).toBe(SAFE_COPY_K09);
    expect(result.notificacion.ventanaMinutos).toEqual({ min: 15, max: 30 });

    const refreshed = await store.findById(conv.id);
    expect(refreshed?.estadoBot).toBe("escalado");
    expect(refreshed?.motivoHandoff).toBe("sin_catalogo");
    expect(refreshed?.escaladoEn).toBeTruthy();

    const events = audit.listByConversacion(conv.id);
    expect(events.some((e) => e.tipo === "bot_handoff")).toBe(true);
  });

  it("pedido humano usa copy específico", () => {
    expect(handoff.safeCopyFor("solicitud_usuario")).toBe(
      SAFE_COPY_HANDOFF_HUMANO,
    );
  });
});
