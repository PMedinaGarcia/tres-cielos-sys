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
  COPY_V4_B1,
  COPY_V4_HANDOFF_EJECUTIVO,
  COPY_V4_HANDOFF_VISITA,
  COPY_V4_NOMBRE,
  COPY_V4_PDF,
  COPY_V4_PRESUPUESTO_CIERRE,
} from "../script/script-v4.copy";

function buildOrchestratorV4(opts?: { fieldTestReset?: boolean }) {
  const config = flowConfig("v4", { fieldTestReset: opts?.fieldTestReset });
  const store = new ConversationStoreService(undefined, config);
  const audit = new AuditEventoService();
  const catalogFake = {
    findSkuBajoPiso: jest.fn(async () => null),
    findSkuPisoVigente: jest.fn(async () => ({
      sku: "EVT-J1-TC",
      nombre: "Paquete Estándar",
      monto: 298_000,
    })),
  } as unknown as CatalogToolsService;
  const orch = new OrchestratorService(
    store,
    new ScriptService(undefined, config),
    new HandoffService(store, audit),
    new IntentClassifierService(),
    new ToolsExecutorService(catalogFake),
    new RegistroConsultaCatalogoService(),
    audit,
    new CrmBriefStubService(),
    new QuotaStubService(),
    new CatalogAwareLlmPort(),
    new StubRagPipeline(),
    new ReasoningTraceService(),
    undefined,
    config,
    undefined,
    catalogFake,
    new NurtureWorkerService(config),
  );
  return { orch, store };
}

async function hastaCta(
  orch: OrchestratorService,
  thread: string,
) {
  const turn = (id: string, texto: string, buttonPayload?: string) =>
    orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: thread,
      externalMessageId: id,
      texto,
      buttonPayload,
      recibidoEn: new Date().toISOString(),
    });
  const t1 = await turn("m1", "Hola");
  const t2 = await turn("m2", "Jun-Sep 2027", "fecha.jun_sep");
  const t3 = await turn("m3", "Ana");
  return { t1, t2, t3, turn };
}

describe("Orchestrator v4 (fecha → nombre → PDF → CTA)", () => {
  it("saludo con temporadas, luego nombre, luego PDF con CTAs", async () => {
    const { orch, store } = buildOrchestratorV4();
    const { t1, t2, t3 } = await hastaCta(orch, "v4-feliz");

    expect(t1.textoRespuesta).toBe(COPY_V4_B1);
    expect(t1.waContent?.kind).toBe("list-picker");
    expect(t1.waContent?.templateId).toBe("guion.fecha_ventana");

    expect(t2.pasoGuion).toBe("nombre");
    expect(t2.textoRespuesta).toBe(COPY_V4_NOMBRE);
    expect(t2.waContent?.kind).toBe("text");

    expect(t3.pasoGuion).toBe("accion");
    expect(t3.textoRespuesta).toBe(COPY_V4_PDF("Ana"));
    expect(t3.waContent?.templateId).toBe("guion.accion_cta");
    expect(t3.waContent?.documents?.map((d) => d.url)).toEqual([
      expect.stringMatching(/experiencia-boda-tres-dias-2027\.pdf$/),
      expect.stringMatching(/tarifas-2027-tres-cielos\.pdf$/),
    ]);
    expect(t3.waContent?.images).toBeUndefined();
    expect(t3.waContent?.list?.items.map((i) => i.id)).toContain("accion.visita");

    const conv = await store.findById(t3.conversacionId);
    expect(conv?.camposCapturados.pdfEnviado).toBe(true);
  });

  it("Conocer Tres Cielos → handoff comercial con intención de visita", async () => {
    const { orch, store } = buildOrchestratorV4();
    const { turn } = await hastaCta(orch, "v4-visita");
    const res = await turn("m4", "Conocer Tres Cielos", "accion.visita");
    expect(res.ruta).toBe("handoff");
    expect(res.estadoBot).toBe("escalado");
    expect(res.textoRespuesta).toBe(COPY_V4_HANDOFF_VISITA("Ana"));
    const conv = await store.findById(res.conversacionId);
    expect(conv?.camposCapturados.intencionVisita).toBe(true);
    expect(conv?.cola).toBe("comercial");
  });

  it("Tengo dudas → handoff comercial con ejecutivo", async () => {
    const { orch } = buildOrchestratorV4();
    const { turn } = await hastaCta(orch, "v4-ejecutivo");
    const res = await turn("m4", "Tengo dudas", "accion.ejecutivo");
    expect(res.ruta).toBe("handoff");
    expect(res.textoRespuesta).toBe(COPY_V4_HANDOFF_EJECUTIVO("Ana"));
  });

  it("Fuera de presupuesto → lista de rango y luego nutrición sin escalar", async () => {
    const { orch, store } = buildOrchestratorV4();
    const { turn } = await hastaCta(orch, "v4-presupuesto");
    const lista = await turn(
      "m4",
      "Estamos fuera de tu presupuesto",
      "accion.fuera_presupuesto",
    );
    expect(lista.estadoBot).toBe("activo");
    expect(lista.waContent?.kind).toBe("list-picker");
    expect(lista.waContent?.templateId).toBe("guion.presupuesto_fuera");
    expect(lista.waContent?.list?.items.map((i) => i.id)).toEqual([
      "presupuesto.r200_250",
      "presupuesto.r250_300",
      "presupuesto.fuera_rango",
    ]);
    const convMid = await store.findById(lista.conversacionId);
    expect(convMid?.pasoGuion).toBe("presupuesto_fuera");
    expect(convMid?.camposCapturados.rutaComercial).toBeUndefined();

    const res = await turn("m5", "250-300 mil", "presupuesto.r250_300");
    expect(res.estadoBot).toBe("activo");
    expect(res.textoRespuesta).toBe(COPY_V4_PRESUPUESTO_CIERRE);
    const conv = await store.findById(res.conversacionId);
    expect(conv?.camposCapturados.rutaComercial).toBe("nutricion");
    expect(conv?.camposCapturados.encajeEconomico).toBe("no");
    expect(conv?.camposCapturados.rangoPresupuestoFuera).toBe("r250_300");
  });

  it("con FIELD_TEST_RESET, tras la visita el siguiente mensaje abre el saludo", async () => {
    const { orch, store } = buildOrchestratorV4({ fieldTestReset: true });
    const { turn } = await hastaCta(orch, "v4-reset-visita");
    await turn("m4", "Conocer Tres Cielos", "accion.visita");
    const again = await turn("m5", "hola");
    expect(again.estadoBot).toBe("activo");
    expect(again.textoRespuesta).toBe(COPY_V4_B1);
    expect(again.waContent?.templateId).toBe("guion.fecha_ventana");
    expect(again.pasoGuion).toBe("fecha_ventana");
    const conv = await store.findById(again.conversacionId);
    expect(conv?.camposCapturados.nombre).toBeFalsy();
    expect(conv?.camposCapturados.ctaGuion).toBeFalsy();
    expect(conv?.estadoBot).toBe("activo");
  });

  it("sin FIELD_TEST_RESET, tras la visita el hilo queda en silencio", async () => {
    const { orch } = buildOrchestratorV4();
    const { turn } = await hastaCta(orch, "v4-silencio-visita");
    await turn("m4", "Conocer Tres Cielos", "accion.visita");
    const again = await turn("m5", "hola");
    expect(again.ruta).toBe("silencio");
    expect(again.textoRespuesta).toBe("");
    expect(again.estadoBot).toBe("escalado");
  });

  it("con FIELD_TEST_RESET, tras el rango fuera de presupuesto vuelve el saludo", async () => {
    const { orch, store } = buildOrchestratorV4({ fieldTestReset: true });
    const { turn } = await hastaCta(orch, "v4-reset-nutricion");
    await turn("m4", "Estamos fuera de tu presupuesto", "accion.fuera_presupuesto");
    await turn("m5", "250-300 mil", "presupuesto.r250_300");
    const again = await turn("m6", "hola");
    expect(again.textoRespuesta).toBe(COPY_V4_B1);
    expect(again.waContent?.templateId).toBe("guion.fecha_ventana");
    expect(again.estadoBot).toBe("activo");
    const conv = await store.findById(again.conversacionId);
    expect(conv?.camposCapturados.rutaComercial).toBeFalsy();
    expect(conv?.camposCapturados.nombre).toBeFalsy();
  });
});
