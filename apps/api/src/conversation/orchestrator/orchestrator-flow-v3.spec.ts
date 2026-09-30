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
import { NurtureWorkerService } from "../nurture/nurture.worker";
import type { CatalogToolsService } from "../../tools-catalog/catalog-tools.service";
import { flowConfig } from "../__tests__/flow-config";
import { COPY_V2_B1, COPY_V2_NUTRICION_HOLD, COPY_V3_VALOR_INLINE } from "../script/script-v2.copy";
import type { PrismaService } from "../../prisma/prisma.service";

function buildOrchestratorV3(prisma?: PrismaService) {
  const config = flowConfig("v3");
  const store = new ConversationStoreService(prisma, config);
  const audit = new AuditEventoService();
  const script = new ScriptService(undefined, config);
  const handoff = new HandoffService(store, audit);
  const intent = new IntentClassifierService();
  const registro = new RegistroConsultaCatalogoService();
  const crm = new CrmBriefStubService(config);
  const quota = new QuotaStubService();
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
    findSkuBajoPiso: jest.fn(async () => null),
    findSkuPisoVigente: jest.fn(async () => ({
      sku: "EVT-J1-TC",
      nombre: "Paquete Estándar",
      monto: 298_000,
    })),
  } as unknown as CatalogToolsService;
  const tools = new ToolsExecutorService(catalogFake);
  const nurture = new NurtureWorkerService(config);
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
    undefined,
    config,
    undefined,
    catalogFake,
    nurture,
  );
  return { orch, store, audit, quota, nurture };
}

describe("Orchestrator v3", () => {
  it("7: precio en B1 → valor + un hueco, sin K09", async () => {
    const { orch } = buildOrchestratorV3();
    const res = await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "v3-precio",
      externalMessageId: "m1",
      texto: "Hola, ¿cuánto cuesta una boda?",
      recibidoEn: new Date().toISOString(),
    });
    expect(res.ruta).not.toBe("handoff");
    expect(res.textoRespuesta).toContain(COPY_V3_VALOR_INLINE);
    expect(res.textoRespuesta).toMatch(/nombre|fecha/i);
    expect(res.textoRespuesta).not.toMatch(/te conecto con un asesor de Tres Cielos, quien te atenderá/);
  });

  it("8: visita + $350k + 150 → nodo visita y cola comercial", async () => {
    const { orch, store } = buildOrchestratorV3();
    const res = await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "v3-visita",
      externalMessageId: "m1",
      texto:
        "Soy Ana Ruiz, quiero visitar para una boda el 22 de diciembre de 2027 para 150 invitados, presupuesto 350 mil",
      recibidoEn: new Date().toISOString(),
    });
    expect(res.ruta).toBe("handoff");
    expect(res.textoRespuesta).toMatch(/visitar el jardín/);
    expect(res.textoRespuesta).toMatch(/Cotizar no aparta fecha/);
    expect(res.textoRespuesta).toMatch(/Ana/);
    const conv = await store.findById(res.conversacionId);
    expect(conv?.camposCapturados.intencionVisita).toBe(true);
    expect(conv?.cola).toBe("comercial");
    expect(conv?.camposCapturados.encajeEconomico).toBe("confirmado");
  });

  it("11: quota dura → guion sin handoff", async () => {
    const { orch, quota } = buildOrchestratorV3();
    quota.setHardLimit(true);
    const res = await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "v3-quota",
      externalMessageId: "m1",
      texto: "Hola",
      recibidoEn: new Date().toISOString(),
    });
    expect(res.ruta).toBe("guion");
    expect(res.estadoBot).toBe("activo");
    expect(res.motivoHandoff).toBeNull();
  });

  it("12: diciembre 2027 → fechaEstado ventana", async () => {
    const { orch, store } = buildOrchestratorV3();
    await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "v3-dic",
      externalMessageId: "m1",
      texto: "Soy Ana, diciembre 2027",
      recibidoEn: new Date().toISOString(),
    });
    const conv = await store.findById(
      (await store.resolveOrCreate({
        canal: "whatsapp",
        externalThreadId: "v3-dic",
      })).id,
    );
    expect(conv?.camposCapturados.fechaEstado).toBe("ventana");
    expect(conv?.camposCapturados.fechaTentativa?.tipo).toBe("mes");
  });

  it("F6 escribe conversation_turn_v3", async () => {
    const { orch, audit } = buildOrchestratorV3();
    const res = await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "v3-evt",
      externalMessageId: "m1",
      texto: "Hola",
      recibidoEn: new Date().toISOString(),
    });
    expect(
      audit.listByConversacion(res.conversacionId).some(
        (e) => e.tipo === "conversation_turn_v3",
      ),
    ).toBe(true);
  });

  it("9: restart a media captura no reenvía B1", async () => {
    const findUnique = jest.fn(async () => ({
      id: "conv-restart",
      clienteId: "cli-1",
      oportunidadId: "opp-1",
      canal: "whatsapp",
      externalThreadId: "v3-restart",
      estadoBot: "activo",
      pasoGuion: "aforo_inversion",
      camposCapturados: {
        nombre: "Ana",
        tipoEvento: "boda",
        fechaTentativa: { tipo: "mes", mes: 12, anio: 2027, flexible: true },
        fechaEstado: "ventana",
      },
      paqueteTentativoId: null,
      ultimaRuta: "guion",
      motivoHandoff: null,
      escaladoEn: null,
      encajeEconomico: null,
      rutaComercial: null,
      guionVersion: "v3",
      creadoEn: new Date("2026-09-01T00:00:00.000Z"),
      actualizadoEn: new Date("2026-09-01T00:00:00.000Z"),
      oportunidad: {
        calificacion: "parcial",
        listoParaCotizar: false,
        briefJson: { version: 1 },
      },
      mensajes: [],
    }));
    const prev = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "postgresql://test";
    const { orch } = buildOrchestratorV3({
      conversacion: { findUnique },
    } as unknown as PrismaService);
    const res = await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "v3-restart",
      externalMessageId: "m-restart",
      texto: "ok",
      recibidoEn: new Date().toISOString(),
    });
    process.env.DATABASE_URL = prev;
    expect(res.textoRespuesta).not.toBe(COPY_V2_B1);
    expect(res.textoRespuesta).toMatch(/personas|escenario|250/i);
  });

  it("10: devolver-a-bot 200 → nutrición sin repetir nombre/fecha", async () => {
    const { orch, store } = buildOrchestratorV3();
    const first = await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "v3-devuelve",
      externalMessageId: "m1",
      texto: "Soy Ana, diciembre 2027",
      recibidoEn: new Date().toISOString(),
    });
    await store.update(first.conversacionId, {
      estadoBot: "activo",
      pasoGuion: "faq_libre",
      camposCapturados: {
        ...(await store.findById(first.conversacionId))!.camposCapturados,
        rutaComercial: "nutricion",
        consentimientoSeguimiento: true,
      },
    });
    const res = await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "v3-devuelve",
      externalMessageId: "m2",
      texto: "gracias",
      recibidoEn: new Date().toISOString(),
    });
    expect(res.textoRespuesta).toBe(COPY_V2_NUTRICION_HOLD);
    expect(res.textoRespuesta).not.toBe(COPY_V2_B1);
    expect(res.textoRespuesta).not.toMatch(/nombre y la fecha/i);
  });
});
