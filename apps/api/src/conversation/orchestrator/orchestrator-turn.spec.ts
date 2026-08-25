import { OrchestratorService } from "./orchestrator.service";
import { ScriptService } from "../script/script.service";
import { HandoffService } from "../handoff/handoff.service";
import { IntentClassifierService } from "./intent-classifier.service";
import { ConversationStoreService } from "../stubs/conversation-store.service";
import { AuditEventoService } from "../stubs/audit-evento.service";
import { CrmBriefStubService } from "../stubs/crm-brief.stub";
import { QuotaStubService } from "../stubs/quota.stub";
import { CatalogAwareLlmPort } from "../stubs/catalog-aware-llm.port";
import { StubRagPipeline } from "../stubs/stub-rag-pipeline";
import { ToolsExecutorService } from "../../tools-catalog/tools-executor.service";
import { RegistroConsultaCatalogoService } from "../../tools-catalog/registro-consulta-catalogo.service";
import { ReasoningTraceService } from "../reasoning/reasoning-trace.service";
import type { CatalogToolsService } from "../../tools-catalog/catalog-tools.service";

function buildOrchestrator(overrides?: {
  tools?: Partial<CatalogToolsService>;
  quotaHard?: boolean;
}) {
  const store = new ConversationStoreService();
  const audit = new AuditEventoService();
  const script = new ScriptService();
  const handoff = new HandoffService(store, audit);
  const intent = new IntentClassifierService();
  const registro = new RegistroConsultaCatalogoService();
  const crm = new CrmBriefStubService();
  const quota = new QuotaStubService();
  if (overrides?.quotaHard) quota.setHardLimit(true);

  const catalogFake = {
    buscarPaquetes: jest.fn(async () => []),
    obtenerPrecioPaquete: jest.fn(async () => ({
      error: "sin_paquete" as const,
    })),
    listarInclusiones: jest.fn(async () => ({ error: "sin_paquete" as const })),
    compararPaquetes: jest.fn(async () => ({ items: [] })),
    evaluarReglasPaquete: jest.fn(async () => ({
      error: "sin_paquete" as const,
    })),
    ...overrides?.tools,
  } as unknown as CatalogToolsService;

  const tools = new ToolsExecutorService(catalogFake);
  const orch = new OrchestratorService(
    store,
    script,
    handoff,
    intent,
    tools,
    registro,
    audit,
    crm,
    quota,
    new CatalogAwareLlmPort(),
    new StubRagPipeline(),
    new ReasoningTraceService(),
  );

  return { orch, store, audit, registro, quota, catalogFake };
}

describe("OrchestratorService.handleTurn (B1/B6)", () => {
  it("ruta guion en primer contacto", async () => {
    const { orch, audit } = buildOrchestrator();
    const res = await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "sandbox-thread-guion",
      externalMessageId: "m1",
      texto: "Hola",
      recibidoEn: new Date().toISOString(),
      perfilCanal: { nombre: null },
    });

    expect(res.ruta).toBe("guion");
    expect(res.textoRespuesta).toMatch(/nombre/i);
    expect(res.estadoBot).toBe("activo");
    expect(res.eventoOperativoId).toBeTruthy();
    expect(res.reasoningTraceId).toBeTruthy();
    expect(res.reasoningTrace?.steps.some((s) => s.level === "intent")).toBe(
      true,
    );
    expect(res.reasoningTrace?.steps.some((s) => s.level === "routing")).toBe(
      true,
    );
    expect(audit.listByConversacion(res.conversacionId).length).toBeGreaterThan(
      0,
    );
  });

  it("handoff forzado por pedido humano → escalado + safe", async () => {
    const { orch, store } = buildOrchestrator();
    const conv = await store.resolveOrCreate({
      canal: "whatsapp",
      externalThreadId: "t-hand-2",
    });
    await store.update(conv.id, { pasoGuion: "faq_libre" });

    const res = await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "t-hand-2",
      externalMessageId: "m-hand",
      texto: "Quiero hablar con un asesor",
      recibidoEn: new Date().toISOString(),
    });

    expect(res.ruta).toBe("handoff");
    expect(res.estadoBot).toBe("escalado");
    expect(res.motivoHandoff).toBe("solicitud_usuario");
    expect(res.textoRespuesta).toMatch(/asesor/i);
  });

  it("estado escalado → silencio sin LLM/tools", async () => {
    const { orch, store } = buildOrchestrator();
    const conv = await store.resolveOrCreate({
      canal: "whatsapp",
      externalThreadId: "t-silencio",
    });
    await store.update(conv.id, { estadoBot: "humano" });

    const res = await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "t-silencio",
      externalMessageId: "m-s",
      texto: "¿cuánto cuesta?",
      recibidoEn: new Date().toISOString(),
    });

    expect(res.ruta).toBe("silencio");
    expect(res.textoRespuesta).toBe("");
  });

  it("RAG stub no implementado → safe/handoff", async () => {
    const { orch, store } = buildOrchestrator();
    const conv = await store.resolveOrCreate({
      canal: "whatsapp",
      externalThreadId: "t-rag",
    });
    await store.update(conv.id, { pasoGuion: "faq_libre" });

    const res = await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "t-rag",
      externalMessageId: "m-rag",
      texto: "¿Cuál es la ubicación del venue?",
      recibidoEn: new Date().toISOString(),
    });

    expect(["handoff", "safe"]).toContain(res.ruta);
    expect(res.textoRespuesta).toBeTruthy();
    expect(res.reasoningTrace?.steps.some((s) => s.level === "rag")).toBe(true);
  });

  it("RAG ok → ruta rag + scores en el trace", async () => {
    const store = new ConversationStoreService();
    const audit = new AuditEventoService();
    const script = new ScriptService();
    const handoff = new HandoffService(store, audit);
    const intent = new IntentClassifierService();
    const registro = new RegistroConsultaCatalogoService();
    const catalogFake = {
      buscarPaquetes: jest.fn(async () => []),
      obtenerPrecioPaquete: jest.fn(),
      listarInclusiones: jest.fn(),
      compararPaquetes: jest.fn(),
      evaluarReglasPaquete: jest.fn(),
    } as unknown as CatalogToolsService;
    const ragOk = {
      async answer() {
        return {
          ok: true,
          texto: "Horarios de visita martes a sábado. [Fuente: K01-faq-general.pdf | tipo: faq]",
          scoresRerank: [0.91],
          fragmentoIds: ["frag-k01-horarios"],
          umbral: 0.85,
          registroRecuperacionId: "rr-1",
          cita: "[Fuente: K01-faq-general.pdf | tipo: faq]",
        };
      },
    };
    const orch = new OrchestratorService(
      store,
      script,
      handoff,
      intent,
      new ToolsExecutorService(catalogFake),
      registro,
      audit,
      new CrmBriefStubService(),
      new QuotaStubService(),
      new CatalogAwareLlmPort(),
      ragOk,
      new ReasoningTraceService(),
    );
    const conv = await store.resolveOrCreate({
      canal: "whatsapp",
      externalThreadId: "t-rag-ok",
    });
    await store.update(conv.id, { pasoGuion: "faq_libre" });

    const res = await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "t-rag-ok",
      externalMessageId: "m-rag-ok",
      texto: "¿Cuál es el horario de visitas?",
      recibidoEn: new Date().toISOString(),
    });

    expect(res.ruta).toBe("rag");
    expect(res.registroRecuperacionId).toBe("rr-1");
    const ragStep = res.reasoningTrace?.steps.find((s) => s.level === "rag");
    expect(ragStep && ragStep.level === "rag" && ragStep.scoresRerank[0]).toBe(
      0.91,
    );
  });
});
