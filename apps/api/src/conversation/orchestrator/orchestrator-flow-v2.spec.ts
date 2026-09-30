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
import {
  COPY_NUTRICION_T24_INMEDIATO,
  COPY_PISO_VISITA,
  COPY_V2_B1,
  COPY_V2_B3,
  COPY_V2_NUTRICION_HOLD,
  copyMenorPisoConAlternativa,
  copyMenorPisoConPisoPublicado,
} from "../script/script-v2.copy";
import { fichaPaquetePorSku } from "./commercial-faq.copy";
import { SKU_PAQUETE_ESTANDAR } from "@tres-cielos/shared";
import type { PrismaService } from "../../prisma/prisma.service";

function buildOrchestratorV2(prisma?: PrismaService) {
  const config = flowConfig("v2");
  const store = new ConversationStoreService(prisma, config);
  const audit = new AuditEventoService();
  const script = new ScriptService(undefined, config);
  const handoff = new HandoffService(store, audit);
  const intent = new IntentClassifierService();
  const registro = new RegistroConsultaCatalogoService();
  const crm = new CrmBriefStubService();
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
  return { orch, store, audit, nurture, catalogFake };
}

describe("Orchestrator v2 (V2.8)", () => {
  it("precalificado → 0 preguntas y handoff comercial", async () => {
    const { orch, store, audit } = buildOrchestratorV2();
    const res = await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "v2-pre",
      externalMessageId: "m1",
      texto:
        "Soy Ana Ruiz, cotización para una boda el 22 de diciembre de 2027 para 150 invitados, presupuesto 350 mil, quiero visitar",
      recibidoEn: new Date().toISOString(),
    });
    expect(res.ruta).toBe("handoff");
    expect(res.estadoBot).toBe("escalado");
    expect(res.textoRespuesta).toBe(COPY_PISO_VISITA);
    expect(res.textoRespuesta).not.toMatch(/¿Me compartes tu nombre/);
    const conv = await store.findById(res.conversacionId);
    expect(conv?.camposCapturados.encajeEconomico).toBe("confirmado");
    expect(conv?.camposCapturados.rutaComercial).toBe("handoff");
    expect(res.waContent?.kind).toBe("text");
    expect(
      audit.listByConversacion(res.conversacionId).some(
        (e) => e.tipo === "bot_handoff",
      ),
    ).toBe(true);
    expect(
      audit.listByConversacion(res.conversacionId).some(
        (e) => e.tipo === "bot_rango_aceptado",
      ),
    ).toBe(true);
  });

  it("$180k pide precios → guardado, sin cola comercial", async () => {
    const { orch, store, audit } = buildOrchestratorV2();
    const res = await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "v2-piso",
      externalMessageId: "m1",
      texto: "Quiero precios, mi presupuesto es 180 mil",
      recibidoEn: new Date().toISOString(),
    });
    expect(res.estadoBot).toBe("activo");
    expect(res.textoRespuesta).toBe(
      copyMenorPisoConPisoPublicado("Paquete Estándar"),
    );
    const conv = await store.findById(res.conversacionId);
    expect(conv?.camposCapturados.encajeEconomico).toBe("no");
    expect(conv?.camposCapturados.rutaComercial).toBe("nutricion");
    expect(conv?.estadoBot).toBe("activo");
    expect(
      audit.listByConversacion(res.conversacionId).some(
        (e) => e.tipo === "bot_nutricion",
      ),
    ).toBe(true);
  });

  it("evade presupuesto → B1, B2, una sola B3, nutrición", async () => {
    const { orch, store } = buildOrchestratorV2();
    const t1 = await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "v2-evade",
      externalMessageId: "m1",
      texto: "Hola",
      recibidoEn: new Date().toISOString(),
    });
    expect(t1.textoRespuesta).toBe(COPY_V2_B1);
    const t2 = await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "v2-evade",
      externalMessageId: "m2",
      texto: "Soy Ana, el 22 de diciembre de 2027",
      recibidoEn: new Date().toISOString(),
    });
    expect(t2.pasoGuion).toBe("aforo_inversion");
    const t3 = await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "v2-evade",
      externalMessageId: "m3",
      texto: "150 invitados, aún por definir",
      recibidoEn: new Date().toISOString(),
    });
    expect(t3.pasoGuion).toBe("aclaracion_piso");
    expect(t3.textoRespuesta).toMatch(/250,000/);
    const t4 = await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "v2-evade",
      externalMessageId: "m4",
      texto: "todavía no",
      recibidoEn: new Date().toISOString(),
    });
    expect(t4.estadoBot).toBe("activo");
    expect(t4.textoRespuesta).toBe(COPY_NUTRICION_T24_INMEDIATO);
    const conv = await store.findById(t4.conversacionId);
    expect(conv?.camposCapturados.rutaComercial).toBe("nutricion");
    expect(conv?.camposCapturados.encajeEconomico).toBe("no_confirmado");
    expect(conv?.camposCapturados.aceptaPiso250k).toBeUndefined();
    expect(conv?.camposCapturados.numeroAclaracionesPiso).toBe(1);
  });

  it("pide humano en B1 → atención general con encaje no_confirmado", async () => {
    const { orch, store } = buildOrchestratorV2();
    const res = await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "v2-humano",
      externalMessageId: "m1",
      texto: "Quiero hablar con un asesor",
      recibidoEn: new Date().toISOString(),
    });
    expect(res.ruta).toBe("handoff");
    expect(res.estadoBot).toBe("escalado");
    const conv = await store.findById(res.conversacionId);
    expect(conv?.camposCapturados.rutaComercial).toBe("atencion_general");
    expect(conv?.camposCapturados.encajeEconomico).toBe("no_confirmado");
  });

  it("XV a mitad del flujo corrige tipo y no reinicia", async () => {
    const { orch, store } = buildOrchestratorV2();
    await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "v2-xv",
      externalMessageId: "m1",
      texto: "Soy Ana, el 22 de diciembre de 2027",
      recibidoEn: new Date().toISOString(),
    });
    const t2 = await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "v2-xv",
      externalMessageId: "m2",
      texto: "en realidad es un xv para 120 invitados",
      recibidoEn: new Date().toISOString(),
    });
    const conv = await store.findById(t2.conversacionId);
    expect(conv?.camposCapturados.tipoEvento).toBe("xv");
    expect(conv?.camposCapturados.nombre?.toLowerCase()).toContain("ana");
    expect(conv?.camposCapturados.aforo).toBe(120);
    expect(conv?.pasoGuion).toBe("aforo_inversion");
  });

  it("tope de 3 mensajes de captura → nutrición", async () => {
    const { orch, store, audit } = buildOrchestratorV2();
    await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "v2-cap",
      externalMessageId: "m1",
      texto: "Hola",
      recibidoEn: new Date().toISOString(),
    });
    await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "v2-cap",
      externalMessageId: "m2",
      texto: "ok",
      recibidoEn: new Date().toISOString(),
    });
    await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "v2-cap",
      externalMessageId: "m3",
      texto: "ok",
      recibidoEn: new Date().toISOString(),
    });
    const t4 = await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "v2-cap",
      externalMessageId: "m4",
      texto: "luego te digo",
      recibidoEn: new Date().toISOString(),
    });
    expect(t4.estadoBot).toBe("activo");
    const conv = await store.findById(t4.conversacionId);
    expect(conv?.camposCapturados.rutaComercial).toBe("nutricion");
    expect(conv?.camposCapturados.numeroMensajesCaptura).toBeGreaterThanOrEqual(
      3,
    );
    expect(
      audit.listByConversacion(t4.conversacionId).some(
        (e) => e.tipo === "bot_nutricion" || e.tipo === "bot_abandono_paso",
      ),
    ).toBe(true);
  });

  it("store vacío con expediente Prisma continúa el paso guardado", async () => {
    const findUnique = jest.fn(async () => ({
      id: "conv-db",
      clienteId: "cli-1",
      oportunidadId: "opp-db",
      canal: "whatsapp",
      externalThreadId: "wa:v2-hydrate",
      estadoBot: "activo",
      pasoGuion: "aforo_inversion",
      camposCapturados: {
        nombre: "Ana",
        tipoEvento: "boda",
        fechaTentativa: { tipo: "dia", fecha: "2027-12-22", flexible: false },
        aforo: 120,
      },
      paqueteTentativoId: null,
      ultimaRuta: "guion",
      motivoHandoff: null,
      escaladoEn: null,
      encajeEconomico: null,
      rutaComercial: null,
      creadoEn: new Date("2026-09-01T00:00:00.000Z"),
      actualizadoEn: new Date("2026-09-01T00:00:00.000Z"),
      mensajes: [],
    }));
    const prisma = { conversacion: { findUnique } } as unknown as PrismaService;
    const prev = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "postgresql://test";
    const { orch, store } = buildOrchestratorV2(prisma);
    const res = await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "wa:v2-hydrate",
      externalMessageId: "m1",
      texto: "350 mil, quiero cotizar",
      recibidoEn: new Date().toISOString(),
    });
    expect(findUnique).toHaveBeenCalled();
    expect(res.conversacionId).toBe("conv-db");
    const conv = await store.findById(res.conversacionId);
    expect(conv?.camposCapturados.nombre).toBe("Ana");
    expect(conv?.pasoGuion).not.toBe("nombre_fecha");
    expect(res.textoRespuesta).not.toBe(COPY_V2_B1);
    process.env.DATABASE_URL = prev;
  });

  it("sandbox: nombre + febrero 2027 + aún por definir abre B3", async () => {
    const { orch } = buildOrchestratorV2();
    await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "v2-sandbox-b3",
      externalMessageId: "m1",
      texto: "Hola",
      recibidoEn: new Date().toISOString(),
    });
    await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "v2-sandbox-b3",
      externalMessageId: "m2",
      texto: "Patricio Medina",
      recibidoEn: new Date().toISOString(),
    });
    await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "v2-sandbox-b3",
      externalMessageId: "m3",
      texto: "Sería en febrero de 2027",
      recibidoEn: new Date().toISOString(),
    });
    const t4 = await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "v2-sandbox-b3",
      externalMessageId: "m4",
      texto: "Aún por definir",
      recibidoEn: new Date().toISOString(),
    });
    expect(t4.pasoGuion).toBe("aclaracion_piso");
    expect(t4.ruta).toBe("guion");
    expect(t4.textoRespuesta).toBe(COPY_V2_B3);
    expect(t4.textoRespuesta).not.toMatch(/Conservamos tu solicitud/);
  });

  it("B3 sí → visita sin pedir aforo", async () => {
    const { orch, store } = buildOrchestratorV2();
    await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "v2-b3-si",
      externalMessageId: "m1",
      texto: "Soy Patricio Medina, febrero 2027",
      recibidoEn: new Date().toISOString(),
    });
    await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "v2-b3-si",
      externalMessageId: "m2",
      texto: "aún por definir",
      recibidoEn: new Date().toISOString(),
    });
    const res = await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "v2-b3-si",
      externalMessageId: "m3",
      texto: "Sí, lo consideramos",
      recibidoEn: new Date().toISOString(),
    });
    expect(res.ruta).toBe("handoff");
    expect(res.textoRespuesta).toBe(COPY_PISO_VISITA);
    const conv = await store.findById(res.conversacionId);
    expect(conv?.camposCapturados.encajeEconomico).toBe("confirmado");
    expect(conv?.camposCapturados.aforo).toBeUndefined();
    expect(conv?.camposCapturados.intencionVisita).toBe(true);
    expect(conv?.cola).toBe("comercial");
  });

  it("B3 no → alternativa sin cola comercial", async () => {
    const { orch, store, nurture } = buildOrchestratorV2();
    await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "v2-b3-no",
      externalMessageId: "m1",
      texto: "Soy Patricio Medina, febrero 2027",
      recibidoEn: new Date().toISOString(),
    });
    await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "v2-b3-no",
      externalMessageId: "m2",
      texto: "aún por definir",
      recibidoEn: new Date().toISOString(),
    });
    const res = await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "v2-b3-no",
      externalMessageId: "m3",
      texto: "Buscamos algo menor",
      recibidoEn: new Date().toISOString(),
    });
    expect(res.ruta).toBe("safe");
    expect(res.textoRespuesta).toBe(
      copyMenorPisoConPisoPublicado("Paquete Estándar"),
    );
    expect(res.textoRespuesta).not.toMatch(/Opción vigente cercana: Upgrade Premium/);
    const conv = await store.findById(res.conversacionId);
    expect(conv?.camposCapturados.encajeEconomico).toBe("no");
    expect(conv?.camposCapturados.rutaComercial).toBe("nutricion");
    expect(conv?.cola).not.toBe("comercial");
    expect(nurture.list(res.conversacionId).some((j) => j.plantillaId === "t24")).toBe(
      true,
    );

    const follow = await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "v2-b3-no",
      externalMessageId: "m4",
      texto: "Quiero conocer",
      recibidoEn: new Date().toISOString(),
    });
    expect(follow.ruta).toBe("catalogo");
    expect(follow.textoRespuesta).toBe(fichaPaquetePorSku(SKU_PAQUETE_ESTANDAR));
    expect(follow.textoRespuesta).not.toBe(res.textoRespuesta);
    const after = await store.findById(follow.conversacionId);
    expect(after?.camposCapturados.rutaComercial).toBe("nutricion");
    expect(after?.cola).not.toBe("comercial");
    expect(nurture.list(follow.conversacionId).filter((j) => !j.cancelado)).toHaveLength(
      2,
    );

    const hold = await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "v2-b3-no",
      externalMessageId: "m5",
      texto: "ok",
      recibidoEn: new Date().toISOString(),
    });
    expect(hold.textoRespuesta).toBe(COPY_V2_NUTRICION_HOLD);
    expect(hold.ruta).toBe("safe");
  });

  it("B3 no con SKU bajo piso nombra la alternativa real", async () => {
    const { orch, catalogFake } = buildOrchestratorV2();
    (catalogFake.findSkuBajoPiso as jest.Mock).mockResolvedValue({
      sku: "EVT-MINI",
      nombre: "Paquete Mini",
      monto: 180_000,
    });
    await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "v2-b3-alt",
      externalMessageId: "m1",
      texto: "Soy Patricio Medina, febrero 2027",
      recibidoEn: new Date().toISOString(),
    });
    await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "v2-b3-alt",
      externalMessageId: "m2",
      texto: "aún por definir",
      recibidoEn: new Date().toISOString(),
    });
    const res = await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "v2-b3-alt",
      externalMessageId: "m3",
      texto: "Buscamos algo menor",
      recibidoEn: new Date().toISOString(),
    });
    expect(res.textoRespuesta).toBe(copyMenorPisoConAlternativa("Paquete Mini"));
    expect(res.textoRespuesta).not.toMatch(/Upgrade Premium/);
  });

  it("B3 sin respuesta → nutrición T+24, sin cierre abrupto", async () => {
    const { orch, store, nurture } = buildOrchestratorV2();
    await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "v2-b3-skip",
      externalMessageId: "m1",
      texto: "Soy Patricio Medina, febrero 2027",
      recibidoEn: new Date().toISOString(),
    });
    await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "v2-b3-skip",
      externalMessageId: "m2",
      texto: "aún por definir",
      recibidoEn: new Date().toISOString(),
    });
    const res = await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "v2-b3-skip",
      externalMessageId: "m3",
      texto: "gracias",
      recibidoEn: new Date().toISOString(),
    });
    expect(res.ruta).toBe("safe");
    expect(res.textoRespuesta).toBe(COPY_NUTRICION_T24_INMEDIATO);
    expect(res.textoRespuesta).not.toMatch(/cuando tengan fecha, aforo o rango/);
    const conv = await store.findById(res.conversacionId);
    expect(conv?.camposCapturados.rutaComercial).toBe("nutricion");
    expect(conv?.estadoBot).toBe("activo");
    expect(nurture.list(res.conversacionId).some((j) => j.plantillaId === "t24")).toBe(
      true,
    );
  });
});
