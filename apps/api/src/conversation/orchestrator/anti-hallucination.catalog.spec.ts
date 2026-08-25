import { assertNoInventedMontos } from "./no-recuperable-precio.gate";
import { CatalogAwareLlmPort } from "../stubs/catalog-aware-llm.port";
import { ToolsExecutorService } from "../../tools-catalog/tools-executor.service";
import type { CatalogToolsService } from "../../tools-catalog/catalog-tools.service";
import { OrchestratorService } from "./orchestrator.service";
import { ScriptService } from "../script/script.service";
import { HandoffService } from "../handoff/handoff.service";
import { IntentClassifierService } from "./intent-classifier.service";
import { ConversationStoreService } from "../stubs/conversation-store.service";
import { AuditEventoService } from "../stubs/audit-evento.service";
import { CrmBriefStubService } from "../stubs/crm-brief.stub";
import { QuotaStubService } from "../stubs/quota.stub";
import { StubRagPipeline } from "../stubs/stub-rag-pipeline";
import { RegistroConsultaCatalogoService } from "../../tools-catalog/registro-consulta-catalogo.service";
import { ReasoningTraceService } from "../reasoning/reasoning-trace.service";

describe("anti-hallucination.catalog (C3)", () => {
  it("CatalogAwareLlm planifica obtener_precio_paquete para SKU", async () => {
    const llm = new CatalogAwareLlmPort();
    const out = await llm.completeWithTools({
      messages: [
        {
          role: "user",
          content: "¿Cuánto cuesta el paquete BODA-J1-ESENCIAL?",
        },
      ],
      tools: [
        {
          name: "obtener_precio_paquete",
          description: "precio",
          parameters: {},
        },
      ],
    });
    expect(out.toolCalls[0]?.name).toBe("obtener_precio_paquete");
    expect(out.toolCalls[0]?.argumentsJson).toContain("BODA-J1-ESENCIAL");
  });

  it("respuesta solo con montos de tool (0 inventados)", async () => {
    const store = new ConversationStoreService();
    const audit = new AuditEventoService();
    const registro = new RegistroConsultaCatalogoService();

    const catalog = {
      obtenerPrecioPaquete: jest.fn(async () => ({
        sku: "BODA-J1-ESENCIAL",
        paqueteId: "pkg-1",
        nombre: "Esencial",
        moneda: "MXN",
        monto: 85000,
        rangoMin: null,
        rangoMax: null,
        unidad: "evento",
        condiciones: null,
        vigenteDesde: new Date(),
        vigenteHasta: null,
      })),
      buscarPaquetes: jest.fn(),
      listarInclusiones: jest.fn(),
      compararPaquetes: jest.fn(),
      evaluarReglasPaquete: jest.fn(),
    } as unknown as CatalogToolsService;

    const orch = new OrchestratorService(
      store,
      new ScriptService(),
      new HandoffService(store, audit),
      new IntentClassifierService(),
      new ToolsExecutorService(catalog),
      registro,
      audit,
      new CrmBriefStubService(),
      new QuotaStubService(),
      new CatalogAwareLlmPort(),
      new StubRagPipeline(),
      new ReasoningTraceService(),
    );

    const conv = await store.resolveOrCreate({
      canal: "whatsapp",
      externalThreadId: "t-c3",
    });
    await store.update(conv.id, { pasoGuion: "faq_libre" });

    const res = await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "t-c3",
      externalMessageId: "m-c3",
      texto: "¿Cuánto cuesta el paquete BODA-J1-ESENCIAL?",
      recibidoEn: new Date().toISOString(),
    });

    expect(res.ruta).toBe("catalogo");
    expect(res.registroConsultaCatalogoId).toBeTruthy();
    expect(res.textoRespuesta).toContain("85000");
    expect(
      assertNoInventedMontos({
        respuesta: res.textoRespuesta ?? "",
        montosPermitidos: [85000],
      }).ok,
    ).toBe(true);

    const reg = await registro.findById(res.registroConsultaCatalogoId!);
    expect(reg?.tool).toBe("obtener_precio_paquete");
    expect(reg?.ok).toBe(true);
  });

  it("sin_precio_vigente → handoff sin inventar monto", async () => {
    const store = new ConversationStoreService();
    const audit = new AuditEventoService();
    const registro = new RegistroConsultaCatalogoService();

    const catalog = {
      obtenerPrecioPaquete: jest.fn(async () => ({
        error: "sin_precio_vigente" as const,
        sku: "BODA-J1-ESENCIAL",
        paqueteId: "pkg-1",
      })),
      buscarPaquetes: jest.fn(),
      listarInclusiones: jest.fn(),
      compararPaquetes: jest.fn(),
      evaluarReglasPaquete: jest.fn(),
    } as unknown as CatalogToolsService;

    const orch = new OrchestratorService(
      store,
      new ScriptService(),
      new HandoffService(store, audit),
      new IntentClassifierService(),
      new ToolsExecutorService(catalog),
      registro,
      audit,
      new CrmBriefStubService(),
      new QuotaStubService(),
      new CatalogAwareLlmPort(),
      new StubRagPipeline(),
      new ReasoningTraceService(),
    );

    const conv = await store.resolveOrCreate({
      canal: "whatsapp",
      externalThreadId: "t-c3b",
    });
    await store.update(conv.id, { pasoGuion: "faq_libre" });

    const res = await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "t-c3b",
      externalMessageId: "m-c3b",
      texto: "¿Cuánto cuesta BODA-J1-ESENCIAL?",
      recibidoEn: new Date().toISOString(),
    });

    expect(res.ruta).toBe("handoff");
    expect(res.motivoHandoff).toBe("sin_catalogo");
    expect(res.textoRespuesta ?? "").not.toMatch(/\$\s?\d/);
  });
});
