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
    diagnosticoBusquedaVacia: jest.fn(async () => ({
      motivo: "sin_publicados" as const,
      cercanos: [],
    })),
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
    expect(res.waContent?.templateId).toBe("guion.nombre");
    expect(res.waContent?.kind).toBe("quick-reply");
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
    expect(res.waContent?.kind).toBe("text");
  });

  it("buttonPayload hablar_asesor escala en medio del guion", async () => {
    const { orch } = buildOrchestrator();
    const res = await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "t-hand-payload",
      externalMessageId: "m-hand-payload",
      texto: "ok",
      buttonPayload: "hablar_asesor",
      recibidoEn: new Date().toISOString(),
    });
    expect(res.ruta).toBe("handoff");
    expect(res.motivoHandoff).toBe("solicitud_usuario");
    expect(res.estadoBot).toBe("escalado");
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
          texto: "Ubicación del jardín. [Fuente: K01-faq-general.pdf | tipo: faq]",
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
      texto: "¿Cuál es la ubicación del venue?",
      recibidoEn: new Date().toISOString(),
    });

    expect(res.ruta).toBe("rag");
    expect(res.registroRecuperacionId).toBe("rr-1");
    const ragStep = res.reasoningTrace?.steps.find((s) => s.level === "rag");
    expect(ragStep && ragStep.level === "rag" && ragStep.scoresRerank[0]).toBe(
      0.91,
    );
  });

  it("aforo válido autosigna Tequesquitengo, adjunta PDF y pasa a intención", async () => {
    const { orch, store } = buildOrchestrator();
    const conv = await store.resolveOrCreate({
      canal: "whatsapp",
      externalThreadId: "t-sede-pdf",
    });
    await store.update(conv.id, {
      pasoGuion: "aforo",
      camposCapturados: {
        nombre: "Ana",
        tipoEvento: "boda",
        fechaTentativa: { tipo: "dia", fecha: "2027-12-22", flexible: false },
      },
    });

    const res = await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "t-sede-pdf",
      externalMessageId: "m-aforo",
      texto: "150",
      recibidoEn: new Date().toISOString(),
    });

    expect(res.ruta).toBe("guion");
    expect(res.pasoGuion).toBe("intencion");
    expect(res.textoRespuesta).toMatch(/Tequesquitengo/);
    expect(res.waContent?.templateId).toBe("guion.intencion");
    expect(res.waContent?.document?.mime).toBe("application/pdf");
    expect(res.waContent?.document?.url).toMatch(/paquete-bodas-2027\.pdf$/);
    const persisted = await store.findById(conv.id);
    expect(persisted?.camposCapturados.sedeId).toBe("sede-tequesquitengo");
    expect(persisted?.camposCapturados.sedeNombre).toBe(
      "Tres Cielos Tequesquitengo",
    );
  });

  it("pregunta genérica de precios lista nombres comerciales y monto vigente", async () => {
    const { orch, store } = buildOrchestrator({
      tools: {
        buscarPaquetes: jest.fn(async () => [
          {
            id: "pkg-1",
            sku: "EVT-J1-TC",
            nombre: "Paquete Estándar",
            tipoEvento: "boda",
            sede: "tequesquitengo",
            aforoMin: 100,
            aforoMax: 300,
            descripcionCorta: "",
            precioTramo: "desde" as const,
            precioMuestra: {
              monto: 2980,
              moneda: "MXN",
              unidad: "persona",
              aforoTramo: 100,
              totalEvento: 298000,
              desde: true,
            },
          },
        ]),
      },
    });
    const conv = await store.resolveOrCreate({
      canal: "whatsapp",
      externalThreadId: "t-precios",
    });
    await store.update(conv.id, {
      pasoGuion: "faq_libre",
      camposCapturados: {
        nombre: "Patricio",
        tipoEvento: "boda",
        aforo: 120,
        sedeId: "sede-tequesquitengo",
        sedeNombre: "Tres Cielos Tequesquitengo",
        fechaTentativa: { tipo: "dia", fecha: "2027-06-15", flexible: false },
      },
    });

    const res = await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "t-precios",
      externalMessageId: "m-precios",
      texto: "Que precios manejan",
      recibidoEn: new Date().toISOString(),
    });

    expect(res.ruta).toBe("catalogo");
    expect(res.textoRespuesta).toContain("Paquete Estándar");
    expect(res.textoRespuesta).toMatch(/MXN 2[,.]980/);
    expect(res.textoRespuesta).not.toContain("EVT-J1-TC");
    expect(res.textoRespuesta).not.toMatch(/filtros/i);
  });

  it("Preico busca catálogo igual que una pregunta de precio", async () => {
    const { orch, store, catalogFake } = buildOrchestrator({
      tools: {
        buscarPaquetes: jest.fn(async () => [
          {
            id: "pkg-1",
            sku: "EVT-J1-TC",
            nombre: "Paquete Estándar",
            tipoEvento: "boda",
            sede: "tequesquitengo",
            aforoMin: 100,
            aforoMax: 300,
            descripcionCorta: "",
            precioTramo: "desde" as const,
            precioMuestra: {
              monto: 2980,
              moneda: "MXN",
              unidad: "persona",
              desde: true,
            },
          },
        ]),
      },
    });
    const conv = await store.resolveOrCreate({
      canal: "whatsapp",
      externalThreadId: "t-preico",
    });
    await store.update(conv.id, { pasoGuion: "faq_libre" });

    const res = await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "t-preico",
      externalMessageId: "m-preico",
      texto: "Preico",
      recibidoEn: new Date().toISOString(),
    });

    expect(res.ruta).toBe("catalogo");
    expect(catalogFake.buscarPaquetes).toHaveBeenCalled();
    expect(res.textoRespuesta).toContain("Paquete Estándar");
  });

  it("búsqueda vacía explica aforo y ofrece el paquete más cercano", async () => {
    const { orch, store } = buildOrchestrator({
      tools: {
        buscarPaquetes: jest.fn(async () => []),
        diagnosticoBusquedaVacia: jest.fn(async () => ({
          motivo: "aforo" as const,
          aforoLead: 20,
          aforoMinCatalogo: 100,
          aforoMaxCatalogo: 300,
          tipoEvento: "boda",
          cercanos: [
            {
              sku: "EVT-J1-TC",
              nombre: "Paquete Estándar",
              aforoMin: 100,
              aforoMax: 300,
              precioMuestra: { monto: 2980, moneda: "MXN", unidad: "persona", desde: true },
            },
          ],
        })),
      },
    });
    const conv = await store.resolveOrCreate({
      canal: "whatsapp",
      externalThreadId: "t-vacio",
    });
    await store.update(conv.id, {
      pasoGuion: "faq_libre",
      camposCapturados: {
        tipoEvento: "boda",
        aforo: 20,
        sedeId: "sede-tequesquitengo",
        sedeNombre: "Tres Cielos Tequesquitengo",
      },
    });

    const res = await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "t-vacio",
      externalMessageId: "m-vacio",
      texto: "Que precios manejan",
      recibidoEn: new Date().toISOString(),
    });

    expect(res.ruta).toBe("catalogo");
    expect(res.textoRespuesta).toContain("20 personas");
    expect(res.textoRespuesta).toContain("Paquete Estándar");
    expect(res.textoRespuesta).toMatch(/asesor/i);
    expect(res.textoRespuesta).not.toMatch(/filtros/i);
  });

  it("paquetes sin precio vigente no inventan monto", async () => {
    const { orch, store } = buildOrchestrator({
      tools: {
        buscarPaquetes: jest.fn(async () => [
          {
            id: "pkg-1",
            sku: "EVT-J1-TC",
            nombre: "Paquete Estándar",
            tipoEvento: "boda",
            sede: "tequesquitengo",
            aforoMin: 100,
            aforoMax: 300,
            descripcionCorta: "",
            precioMuestra: null,
          },
        ]),
      },
    });
    const conv = await store.resolveOrCreate({
      canal: "whatsapp",
      externalThreadId: "t-vigencia",
    });
    await store.update(conv.id, {
      pasoGuion: "faq_libre",
      camposCapturados: {
        tipoEvento: "boda",
        aforo: 120,
        fechaTentativa: { tipo: "dia", fecha: "2027-12-22", flexible: false },
      },
    });

    const res = await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "t-vigencia",
      externalMessageId: "m-vigencia",
      texto: "Que precios manejan",
      recibidoEn: new Date().toISOString(),
    });

    expect(res.ruta).toBe("catalogo");
    expect(res.textoRespuesta).toContain("Paquete Estándar");
    expect(res.textoRespuesta).toMatch(/aún no hay precio publicado/i);
    expect(res.textoRespuesta ?? "").not.toMatch(/\$\s?\d/);
  });

  it("Politicas en faq_libre responde briefing, no handoff", async () => {
    const { orch, store } = buildOrchestrator();
    const conv = await store.resolveOrCreate({
      canal: "whatsapp",
      externalThreadId: "t-politicas",
    });
    await store.update(conv.id, { pasoGuion: "faq_libre" });

    const res = await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "t-politicas",
      externalMessageId: "m-politicas",
      texto: "Politicas",
      recibidoEn: new Date().toISOString(),
    });

    expect(res.ruta).toBe("catalogo");
    expect(res.estadoBot).toBe("activo");
    expect(res.textoRespuesta).toMatch(/20%/);
    expect(res.textoRespuesta).toMatch(/2:00/);
    expect(res.textoRespuesta).toMatch(/barra libre/i);
    expect(res.textoRespuesta).not.toMatch(/no puedo confirmar ese dato/i);
    expect(res.waContent?.templateId).toBe("canal.catalogo");
  });

  it("horarios y exclusiones no escalan", async () => {
    const { orch, store } = buildOrchestrator();
    await store.update(
      (
        await store.resolveOrCreate({
          canal: "whatsapp",
          externalThreadId: "t-horario",
        })
      ).id,
      { pasoGuion: "faq_libre" },
    );

    const horario = await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "t-horario",
      externalMessageId: "m-horario",
      texto: "Horarios",
      recibidoEn: new Date().toISOString(),
    });
    expect(horario.ruta).toBe("catalogo");
    expect(horario.textoRespuesta).toMatch(/11 horas/i);
    expect(horario.textoRespuesta).not.toMatch(/no puedo confirmar ese dato/i);

    await store.update(
      (
        await store.resolveOrCreate({
          canal: "whatsapp",
          externalThreadId: "t-excl",
        })
      ).id,
      { pasoGuion: "faq_libre" },
    );
    const excl = await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "t-excl",
      externalMessageId: "m-excl",
      texto: "exclusiones",
      recibidoEn: new Date().toISOString(),
    });
    expect(excl.ruta).toBe("catalogo");
    expect(excl.textoRespuesta).toMatch(/no incluye barra libre/i);
  });

  it("fecha minima de contratacion escala a asesor", async () => {
    const { orch, store } = buildOrchestrator();
    const conv = await store.resolveOrCreate({
      canal: "whatsapp",
      externalThreadId: "t-fecha-min",
    });
    await store.update(conv.id, { pasoGuion: "faq_libre" });

    const res = await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "t-fecha-min",
      externalMessageId: "m-fecha-min",
      texto: "fecha minima de contratacion",
      recibidoEn: new Date().toISOString(),
    });

    expect(res.ruta).toBe("handoff");
    expect(res.motivoHandoff).toBe("otro");
    expect(res.estadoBot).toBe("escalado");
  });

  it("que tiene el estandar lista ficha del paquete, no handoff", async () => {
    const { orch, store, catalogFake } = buildOrchestrator({
      tools: {
        listarInclusiones: jest.fn(async () => ({
          sku: "EVT-J1-TC",
          paqueteId: "pkg-1",
          nombre: "Paquete Estándar",
          inclusiones: [
            {
              nombre: "Evento de tres días",
              categoria: "otro" as const,
              cantidad: null,
              unidad: null,
              obligatoria: true,
            },
            {
              nombre: "Renta del jardín por 11 horas",
              categoria: "otro" as const,
              cantidad: null,
              unidad: null,
              obligatoria: true,
            },
            {
              nombre: "Banquete 3 tiempos",
              categoria: "catering" as const,
              cantidad: null,
              unidad: null,
              obligatoria: true,
            },
          ],
        })),
      },
    });
    const conv = await store.resolveOrCreate({
      canal: "whatsapp",
      externalThreadId: "t-estandar",
    });
    await store.update(conv.id, { pasoGuion: "faq_libre" });

    const res = await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "t-estandar",
      externalMessageId: "m-estandar",
      texto: "que tiene el estandar",
      recibidoEn: new Date().toISOString(),
    });

    expect(catalogFake.listarInclusiones).toHaveBeenCalled();
    expect(res.ruta).toBe("catalogo");
    expect(res.textoRespuesta).toMatch(/tres días/i);
    expect(res.textoRespuesta).toMatch(/barra libre/i);
    expect(res.textoRespuesta).not.toMatch(/no puedo confirmar ese dato/i);
    expect(res.estadoBot).toBe("activo");
  });
});
