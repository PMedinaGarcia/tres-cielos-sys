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
    expect(res.waContent?.kind).toBe("text");
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
    expect(res.textoRespuesta).toMatch(/asesor/);
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
      texto: "política de estacionamiento",
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
      texto: "política de estacionamiento",
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
    expect(res.textoRespuesta).toMatch(/Lote 36/);
    expect(res.waContent?.templateId).toBe("guion.intencion");
    expect(res.waContent?.documents?.map((d) => d.mime)).toEqual([
      "application/pdf",
      "application/pdf",
    ]);
    expect(res.waContent?.documents?.map((d) => d.url)).toEqual([
      expect.stringMatching(/experiencia-boda-tres-dias-2027\.pdf$/),
      expect.stringMatching(/tarifas-2027-tres-cielos\.pdf$/),
    ]);
    expect(res.waContent?.images).toBeUndefined();
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
    expect(res.textoRespuesta).toMatch(/tarifas vigentes son 2027/i);
    expect(res.textoRespuesta).toMatch(/día, mes y año de 2027/i);
    expect(res.textoRespuesta ?? "").not.toMatch(/\$\s?\d/);
    const after = await store.findById(conv.id);
    expect(after?.paqueteTentativoId).toBe("pkg-1");
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

  it("cotización inicial pide nombre, persiste slots y no abre catálogo", async () => {
    const paquetes = [
      {
        id: "pkg-1",
        sku: "EVT-J1-TC",
        nombre: "Paquete Estándar",
        tipoEvento: "boda",
        sede: "tequesquitengo",
        aforoMin: 100,
        aforoMax: 300,
        descripcionCorta: "",
        precioTramo: "exact" as const,
        precioMuestra: {
          monto: 2550,
          moneda: "MXN",
          unidad: "persona",
          aforoTramo: 150,
          totalEvento: 382500,
          desde: false,
        },
      },
    ];
    const { orch, store, catalogFake, audit } = buildOrchestrator({
      tools: {
        buscarPaquetes: jest.fn(async () => paquetes),
      },
    });
    const thread = "t-slot-fill-sandbox";
    const t1 = await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: thread,
      externalMessageId: "m-cotiz",
      texto:
        "Necesito que me ayudes con una cotización para una boda el 22 de diciembre del 2027 para 150 invitados",
      recibidoEn: new Date().toISOString(),
      perfilCanal: { nombre: null },
    });

    expect(t1.ruta).toBe("guion");
    expect(t1.pasoGuion).toBe("nombre");
    expect(t1.textoRespuesta).toMatch(/nombre/i);
    expect(t1.textoRespuesta).not.toMatch(/tipo de evento/i);
    expect(t1.waContent?.templateId).toBe("guion.nombre");
    expect(catalogFake.buscarPaquetes).not.toHaveBeenCalled();
    const t1Saliente = audit
      .listByConversacion(t1.conversacionId)
      .find((e) => e.tipo === "bot_mensaje_saliente");
    expect(t1Saliente?.payload.pedidoCotizacion ?? null).toBeNull();

    const conv = await store.resolveOrCreate({
      canal: "whatsapp",
      externalThreadId: thread,
    });
    expect(conv.camposCapturados.tipoEvento).toBe("boda");
    expect(conv.camposCapturados.aforo).toBe(150);
    expect(conv.camposCapturados.fechaTentativa).toMatchObject({
      tipo: "dia",
      fecha: "2027-12-22",
    });
    expect(conv.camposCapturados.intencionCotizar).toBe(true);
    expect(conv.camposCapturados.nombre).toBeFalsy();
    expect(conv.pasoGuion).toBe("nombre");

    const t2 = await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: thread,
      externalMessageId: "m-nombre",
      texto: "Paty",
      recibidoEn: new Date().toISOString(),
      perfilCanal: { nombre: null },
    });

    expect(t2.ruta).toBe("catalogo");
    expect(t2.pasoGuion).toBe("faq_libre");
    expect(t2.textoRespuesta).not.toMatch(/tipo de evento/i);
    expect(t2.waContent?.templateId).not.toBe("guion.ocasion");
    expect(catalogFake.buscarPaquetes).toHaveBeenCalledWith(
      expect.objectContaining({
        aforo: 150,
        fecha: "2027-12-22",
        tipoEvento: "boda",
      }),
    );
    const routing = t2.reasoningTrace?.steps.find((s) => s.level === "routing");
    expect(routing && "inputs" in routing && routing.inputs.pedidoCotizacion).toBe(
      true,
    );
    expect(
      routing && "inputs" in routing && routing.inputs.pedidoCotizacionFuente,
    ).toBe("intencion_previa");
    const t2Salientes = audit
      .listByConversacion(t2.conversacionId)
      .filter((e) => e.tipo === "bot_mensaje_saliente");
    const t2Saliente = t2Salientes[t2Salientes.length - 1];
    expect(t2Saliente?.payload.pedidoCotizacion).toBe(true);
    expect(t2Saliente?.payload.pedidoCotizacionFuente).toBe("intencion_previa");
    const afterName = await store.resolveOrCreate({
      canal: "whatsapp",
      externalThreadId: thread,
    });
    expect(afterName.camposCapturados.nombre?.toLowerCase()).toBe("paty");

    const t3 = await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: thread,
      externalMessageId: "m-precios",
      texto: "Que precios manejan",
      recibidoEn: new Date().toISOString(),
      perfilCanal: { nombre: null },
    });

    expect(t3.ruta).toBe("catalogo");
    expect(catalogFake.buscarPaquetes).toHaveBeenCalledWith(
      expect.objectContaining({
        aforo: 150,
        fecha: "2027-12-22",
        tipoEvento: "boda",
      }),
    );
  });

  it("rechazo en intencion no abre catálogo", async () => {
    const { orch, store, catalogFake, audit } = buildOrchestrator({
      tools: {
        buscarPaquetes: jest.fn(async () => []),
      },
    });
    const conv = await store.resolveOrCreate({
      canal: "whatsapp",
      externalThreadId: "t-rechazo",
    });
    await store.update(conv.id, {
      pasoGuion: "intencion",
      camposCapturados: {
        nombre: "Paty",
        tipoEvento: "boda",
        fechaTentativa: { tipo: "dia", fecha: "2027-12-22", flexible: false },
        aforo: 150,
        sedeId: "sede-tequesquitengo",
        sedeNombre: "Tres Cielos Tequesquitengo",
      },
    });

    const res = await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "t-rechazo",
      externalMessageId: "m-no",
      texto: "no",
      recibidoEn: new Date().toISOString(),
      perfilCanal: { nombre: null },
    });

    expect(res.ruta).toBe("guion");
    expect(res.pasoGuion).toBe("faq_libre");
    expect(res.textoRespuesta).toMatch(/si más adelante quieres cotizar/i);
    expect(catalogFake.buscarPaquetes).not.toHaveBeenCalled();
    const saliente = audit
      .listByConversacion(res.conversacionId)
      .find((e) => e.tipo === "bot_mensaje_saliente");
    expect(saliente?.payload.pedidoCotizacion).toBe(false);
    expect(saliente?.payload.pedidoCotizacionFuente).toBe("rechazo");
  });

  it("nombre de perfil + cotización rica igual pide nombre", async () => {
    const { orch, store, catalogFake } = buildOrchestrator({
      tools: {
        buscarPaquetes: jest.fn(async () => []),
      },
    });
    const t1 = await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "t-perfil-nombre",
      externalMessageId: "m-cotiz-perfil",
      texto:
        "Quiero cotizar una boda para 150 personas el 22 de diciembre 2027",
      recibidoEn: new Date().toISOString(),
      perfilCanal: { nombre: "Ana" },
    });

    expect(t1.ruta).toBe("guion");
    expect(t1.pasoGuion).toBe("nombre");
    expect(t1.textoRespuesta).toMatch(/nombre/i);
    expect(catalogFake.buscarPaquetes).not.toHaveBeenCalled();

    const conv = await store.resolveOrCreate({
      canal: "whatsapp",
      externalThreadId: "t-perfil-nombre",
    });
    expect(conv.camposCapturados.nombre).toBeFalsy();
    expect(conv.camposCapturados.tipoEvento).toBe("boda");
    expect(conv.camposCapturados.aforo).toBe(150);
  });

  it("corrige fecha 2026→2027 en faq_libre y recotiza en catálogo", async () => {
    const { orch, store, catalogFake, audit } = buildOrchestrator({
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
            precioMuestra: {
              monto: 2280,
              moneda: "MXN",
              unidad: "persona",
              aforoTramo: 150,
              totalEvento: 342000,
            },
          },
        ]),
      },
    });
    const conv = await store.resolveOrCreate({
      canal: "whatsapp",
      externalThreadId: "t-recotizar-fecha",
    });
    await store.update(conv.id, {
      pasoGuion: "faq_libre",
      camposCapturados: {
        nombre: "Patricio Medina",
        tipoEvento: "boda",
        fechaTentativa: { tipo: "dia", fecha: "2026-12-22", flexible: false },
        aforo: 150,
        sedeId: "sede-tequesquitengo",
        sedeNombre: "Tres Cielos Tequesquitengo",
        intencionCotizar: true,
      },
    });

    const res = await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "t-recotizar-fecha",
      externalMessageId: "m-fecha-2027",
      texto: "Para el 22 de Enero de 2027 entonces",
      recibidoEn: new Date().toISOString(),
    });

    expect(res.ruta).toBe("catalogo");
    expect(catalogFake.buscarPaquetes).toHaveBeenCalledWith(
      expect.objectContaining({
        fecha: "2027-01-22",
        aforo: 150,
        tipoEvento: "boda",
      }),
    );
    const after = await store.findById(conv.id);
    expect(after?.camposCapturados.fechaTentativa).toMatchObject({
      tipo: "dia",
      fecha: "2027-01-22",
    });
    expect(after?.paqueteTentativoId).toBe("pkg-1");
    expect(after?.listoParaCotizar).toBe(true);
    expect(after?.brief).toEqual(
      expect.objectContaining({
        consultaCatalogoAlMomento: expect.objectContaining({
          tool: "buscar_paquetes",
          ok: true,
        }),
      }),
    );
    expect(
      audit
        .listByConversacion(res.conversacionId)
        .some((e) => e.tipo === "consulta_catalogo"),
    ).toBe(true);
    expect(res.textoRespuesta).toMatch(/Paquete Estándar/);
    expect(res.textoRespuesta).not.toMatch(/no tengo esa información/i);
  });

  it("corrige aforo en faq_libre y recotiza en catálogo", async () => {
    const { orch, store, catalogFake } = buildOrchestrator({
      tools: {
        buscarPaquetes: jest.fn(async () => [
          {
            id: "pkg-1",
            sku: "EVT-J1-TC",
            nombre: "Paquete Estándar",
            aforoMin: 100,
            aforoMax: 300,
            precioMuestra: { monto: 2280, moneda: "MXN", unidad: "persona" },
          },
        ]),
      },
    });
    const conv = await store.resolveOrCreate({
      canal: "whatsapp",
      externalThreadId: "t-recotizar-aforo",
    });
    await store.update(conv.id, {
      pasoGuion: "faq_libre",
      camposCapturados: {
        nombre: "Patricio Medina",
        tipoEvento: "boda",
        fechaTentativa: { tipo: "dia", fecha: "2027-12-22", flexible: false },
        aforo: 150,
        sedeId: "sede-tequesquitengo",
        sedeNombre: "Tres Cielos Tequesquitengo",
        intencionCotizar: true,
      },
    });

    const res = await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "t-recotizar-aforo",
      externalMessageId: "m-aforo-200",
      texto: "ahora para 200 invitados",
      recibidoEn: new Date().toISOString(),
    });

    expect(res.ruta).toBe("catalogo");
    expect(catalogFake.buscarPaquetes).toHaveBeenCalledWith(
      expect.objectContaining({ aforo: 200, fecha: "2027-12-22" }),
    );
    const after = await store.findById(conv.id);
    expect(after?.camposCapturados.aforo).toBe(200);
  });

  it("pregunta de ubicación en cotización entrega dirección, no recotiza", async () => {
    const { orch, store, catalogFake } = buildOrchestrator();
    const conv = await store.resolveOrCreate({
      canal: "whatsapp",
      externalThreadId: "t-venue-fecha",
    });
    await store.update(conv.id, {
      pasoGuion: "faq_libre",
      camposCapturados: {
        nombre: "Patricio Medina",
        tipoEvento: "boda",
        fechaTentativa: { tipo: "dia", fecha: "2026-12-22", flexible: false },
        aforo: 150,
        sedeId: "sede-tequesquitengo",
        sedeNombre: "Tres Cielos Tequesquitengo",
        intencionCotizar: true,
      },
    });

    const res = await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "t-venue-fecha",
      externalMessageId: "m-ubicacion",
      texto: "¿Cuál es la ubicación del venue el 22 de enero de 2027?",
      recibidoEn: new Date().toISOString(),
    });

    expect(res.textoRespuesta).toMatch(/Lote 36/);
    expect(res.textoRespuesta).toMatch(/Bajada 6/);
    const routing = res.reasoningTrace?.steps.find((s) => s.level === "routing");
    expect(
      routing && routing.level === "routing" && routing.decision.kind,
    ).toBe("faq_comercial");
    expect(catalogFake.buscarPaquetes).not.toHaveBeenCalled();
  });
});
