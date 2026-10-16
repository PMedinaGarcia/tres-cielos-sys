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
import type { RagPipelinePort } from "../stubs/rag-pipeline.port";
import { COPY_V2_NUTRICION_HOLD, COPY_V3_RAG_SAFE_FAQ } from "../script/script-v2.copy";
import { SAFE_COPY_BOT_SILENCIADO } from "../handoff/safe-copy";
import { ToolsExecutorService } from "../../tools-catalog/tools-executor.service";
import { RegistroConsultaCatalogoService } from "../../tools-catalog/registro-consulta-catalogo.service";
import { ReasoningTraceService } from "../reasoning/reasoning-trace.service";
import { NurtureWorkerService } from "../nurture/nurture.worker";
import type { CatalogToolsService } from "../../tools-catalog/catalog-tools.service";
import { flowConfig } from "../__tests__/flow-config";
import {
  REINICIAR_FLUJO_LINEA,
  REINICIAR_FLUJO_PAYLOAD,
} from "@tres-cielos/shared";
import {
  COPY_V4_B1,
  COPY_V4_HANDOFF_EJECUTIVO,
  COPY_V4_HANDOFF_VISITA,
  COPY_V4_NOMBRE,
  COPY_V4_PDF,
  COPY_V4_PRESUPUESTO_CIERRE,
} from "../script/script-v4.copy";

function ragOk(texto = "El jardín tiene estacionamiento propio. [Fuente: K01]"): RagPipelinePort {
  return {
    async answer() {
      return {
        ok: true,
        texto,
        scoresRerank: [0.91],
        fragmentoIds: ["frag-k01"],
        umbral: 0.85,
        registroRecuperacionId: "rr-v4",
        cita: "[Fuente: K01]",
      };
    },
  };
}

function buildOrchestratorV4(opts?: {
  fieldTestReset?: boolean;
  rag?: RagPipelinePort;
}) {
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
    opts?.rag ?? new StubRagPipeline(),
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

  it("tras la temporada, Patricio abre el PDF y no vuelve a pedir el nombre", async () => {
    const { orch } = buildOrchestratorV4();
    const temporada = await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "v4-patricio",
      externalMessageId: "p1",
      texto: "Jun-Sep 2027",
      buttonPayload: "fecha.jun_sep",
      recibidoEn: new Date().toISOString(),
    });
    const nombre = await orch.handleTurn({
      canal: "whatsapp",
      externalThreadId: "v4-patricio",
      externalMessageId: "p2",
      texto: "Patricio",
      recibidoEn: new Date().toISOString(),
    });
    expect(temporada.pasoGuion).toBe("nombre");
    expect(temporada.textoRespuesta).toBe(COPY_V4_NOMBRE);
    expect(nombre.pasoGuion).toBe("accion");
    expect(nombre.textoRespuesta).toBe(COPY_V4_PDF("Patricio"));
    expect(nombre.textoRespuesta).not.toContain("¿Con quién tenemos el gusto?");
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
    const cierre = await turn("m4", "Conocer Tres Cielos", "accion.visita");
    expect(cierre.textoRespuesta).toContain(COPY_V4_HANDOFF_VISITA("Ana"));
    expect(cierre.textoRespuesta).toContain(REINICIAR_FLUJO_LINEA);
    expect(cierre.waContent?.kind).toBe("quick-reply");
    expect(cierre.waContent?.buttons?.map((btn) => btn.id)).toEqual([
      REINICIAR_FLUJO_PAYLOAD,
    ]);
    const again = await turn("m5", "REINICIAR");
    expect(again.estadoBot).toBe("activo");
    expect(again.textoRespuesta).toBe(COPY_V4_B1);
    expect(again.waContent?.templateId).toBe("guion.fecha_ventana");
    expect(again.pasoGuion).toBe("fecha_ventana");
    const conv = await store.findById(again.conversacionId);
    expect(conv?.camposCapturados.nombre).toBeFalsy();
    expect(conv?.camposCapturados.ctaGuion).toBeFalsy();
    expect(conv?.estadoBot).toBe("activo");
  });

  it("sin FIELD_TEST_RESET, tras la visita una duda documental no silencia el hilo", async () => {
    const { orch, store } = buildOrchestratorV4({ rag: ragOk() });
    const { turn } = await hastaCta(orch, "v4-rag-visita");
    const handoff = await turn("m4", "Conocer Tres Cielos", "accion.visita");
    expect(handoff.waContent?.kind).toBe("quick-reply");
    expect(handoff.estadoBot).toBe("escalado");
    const again = await turn("m5", "política de estacionamiento");
    expect(again.ruta).toBe("rag");
    expect(again.textoRespuesta).toContain("estacionamiento");
    expect(again.estadoBot).toBe("escalado");
    const conv = await store.findById(again.conversacionId);
    expect(conv?.estadoBot).toBe("escalado");
    expect(conv?.camposCapturados.rutaComercial).toBe("handoff");
    expect(conv?.cola).toBe("comercial");
  });

  it("si el RAG falla tras la visita, responde safe sin silencio ni nuevo handoff", async () => {
    const { orch, store } = buildOrchestratorV4();
    const { turn } = await hastaCta(orch, "v4-rag-visita-fallo");
    await turn("m4", "Conocer Tres Cielos", "accion.visita");
    const again = await turn("m5", "política de estacionamiento");
    expect(again.ruta).toBe("safe");
    expect(again.textoRespuesta).toBe(COPY_V3_RAG_SAFE_FAQ);
    expect(again.estadoBot).toBe("escalado");
    const conv = await store.findById(again.conversacionId);
    expect(conv?.estadoBot).toBe("escalado");
    expect(conv?.motivoHandoff).toBe("solicitud_usuario");
  });

  it("tras la visita, pedir humano otra vez no vuelve a escalar", async () => {
    const { orch } = buildOrchestratorV4();
    const { turn } = await hastaCta(orch, "v4-visita-ya-escalado");
    await turn("m4", "Conocer Tres Cielos", "accion.visita");
    const again = await turn("m5", "Quiero hablar con un asesor");
    expect(again.ruta).toBe("safe");
    expect(again.textoRespuesta).toBe(SAFE_COPY_BOT_SILENCIADO);
    expect(again.estadoBot).toBe("escalado");
  });

  it("tras el handoff, «inicio» o el botón vuelven al saludo", async () => {
    const { orch, store } = buildOrchestratorV4();
    const { turn } = await hastaCta(orch, "v4-reinicio-visita");
    await turn("m4", "Conocer Tres Cielos", "accion.visita");
    const again = await turn("m5", "inicio");
    expect(again.estadoBot).toBe("activo");
    expect(again.textoRespuesta).toBe(COPY_V4_B1);
    expect(again.waContent?.templateId).toBe("guion.fecha_ventana");
    expect(again.pasoGuion).toBe("fecha_ventana");
    const conv = await store.findById(again.conversacionId);
    expect(conv?.camposCapturados.nombre).toBeFalsy();
    expect(conv?.camposCapturados.ctaGuion).toBeFalsy();

    const { turn: turnBtn } = await hastaCta(orch, "v4-reinicio-boton");
    await turnBtn("m4", "Tengo dudas", "accion.ejecutivo");
    const desdeBoton = await turnBtn("m5", "Volver al inicio", "flujo.reiniciar");
    expect(desdeBoton.textoRespuesta).toBe(COPY_V4_B1);
    expect(desdeBoton.estadoBot).toBe("activo");
  });

  it("con FIELD_TEST_RESET, tras el rango fuera de presupuesto vuelve el saludo", async () => {
    const { orch, store } = buildOrchestratorV4({ fieldTestReset: true });
    const { turn } = await hastaCta(orch, "v4-reset-nutricion");
    await turn("m4", "Estamos fuera de tu presupuesto", "accion.fuera_presupuesto");
    const cierre = await turn("m5", "250-300 mil", "presupuesto.r250_300");
    expect(cierre.textoRespuesta).toContain(COPY_V4_PRESUPUESTO_CIERRE);
    expect(cierre.textoRespuesta).toContain(REINICIAR_FLUJO_LINEA);
    expect(cierre.waContent?.buttons?.map((btn) => btn.id)).toContain(
      REINICIAR_FLUJO_PAYLOAD,
    );
    const again = await turn("m6", "Reiniciar prueba", REINICIAR_FLUJO_PAYLOAD);
    expect(again.textoRespuesta).toBe(COPY_V4_B1);
    expect(again.waContent?.templateId).toBe("guion.fecha_ventana");
    expect(again.estadoBot).toBe("activo");
    const conv = await store.findById(again.conversacionId);
    expect(conv?.camposCapturados.rutaComercial).toBeFalsy();
    expect(conv?.camposCapturados.nombre).toBeFalsy();
  });

  it("tras el cierre de presupuesto, una pregunta sigue por RAG y no por el hold", async () => {
    const { orch, store } = buildOrchestratorV4({ rag: ragOk("Hay capilla en el jardín.") });
    const { turn } = await hastaCta(orch, "v4-rag-presupuesto");
    await turn("m4", "Estamos fuera de tu presupuesto", "accion.fuera_presupuesto");
    const cierre = await turn("m5", "250-300 mil", "presupuesto.r250_300");
    expect(cierre.textoRespuesta).toBe(COPY_V4_PRESUPUESTO_CIERRE);
    expect(cierre.estadoBot).toBe("activo");

    const duda = await turn("m6", "política de estacionamiento");
    expect(duda.ruta).toBe("rag");
    expect(duda.textoRespuesta).toBe("Hay capilla en el jardín.");
    expect(duda.textoRespuesta).not.toBe(COPY_V2_NUTRICION_HOLD);
    expect(duda.estadoBot).toBe("activo");
    const conv = await store.findById(duda.conversacionId);
    expect(conv?.camposCapturados.rutaComercial).toBe("nutricion");
    expect(conv?.estadoBot).toBe("activo");
  });

  it("si el RAG falla tras el cierre de presupuesto, queda en safe sin escalar", async () => {
    const { orch, store } = buildOrchestratorV4();
    const { turn } = await hastaCta(orch, "v4-rag-presupuesto-fallo");
    await turn("m4", "Estamos fuera de tu presupuesto", "accion.fuera_presupuesto");
    await turn("m5", "200-250 mil", "presupuesto.r200_250");
    const duda = await turn("m6", "tienen capilla");
    expect(duda.ruta).toBe("safe");
    expect(duda.textoRespuesta).toBe(COPY_V3_RAG_SAFE_FAQ);
    expect(duda.textoRespuesta).not.toBe(COPY_V2_NUTRICION_HOLD);
    expect(duda.estadoBot).toBe("activo");
    const conv = await store.findById(duda.conversacionId);
    expect(conv?.estadoBot).toBe("activo");
    expect(conv?.camposCapturados.rutaComercial).toBe("nutricion");
  });

  it("una segunda duda tras el cierre tampoco repite el hold", async () => {
    const { orch } = buildOrchestratorV4({
      rag: ragOk("El dress code es formal."),
    });
    const { turn } = await hastaCta(orch, "v4-rag-presupuesto-dos");
    await turn("m4", "Fuera de presupuesto", "accion.fuera_presupuesto");
    await turn("m5", "Fuera de rango", "presupuesto.fuera_rango");
    const primera = await turn("m6", "dress code");
    const segunda = await turn("m7", "tienen capilla");
    expect(primera.ruta).toBe("rag");
    expect(segunda.ruta).toBe("rag");
    expect(segunda.textoRespuesta).not.toBe(COPY_V2_NUTRICION_HOLD);
    expect(segunda.estadoBot).toBe("activo");
  });

  it("cuando el asesor toma el hilo, el RAG deja de contestar y no cambia la cola", async () => {
    let llamadas = 0;
    const rag: RagPipelinePort = {
      async answer() {
        llamadas += 1;
        return {
          ok: true,
          texto: "Hay capilla en el jardín.",
          scoresRerank: [0.91],
          fragmentoIds: ["frag-k01"],
          umbral: 0.85,
          registroRecuperacionId: "rr-asesor",
          cita: "[Fuente: K01]",
        };
      },
    };
    const { orch, store } = buildOrchestratorV4({ rag });
    const { turn } = await hastaCta(orch, "v4-asesor-no-solapa");
    const handoff = await turn("m4", "Conocer Tres Cielos", "accion.visita");
    expect(handoff.estadoBot).toBe("escalado");

    const antes = await turn("m5", "política de estacionamiento");
    expect(antes.ruta).toBe("rag");
    expect(llamadas).toBe(1);
    const conv = await store.findById(antes.conversacionId);
    expect(conv?.cola).toBe("comercial");

    await store.update(antes.conversacionId, {
      estadoBot: "humano",
      asesorLockId: "asesor-1",
    });

    const visita = await turn("m6", "tienen capilla");
    const presupuesto = await (async () => {
      const { turn: turnPresupuesto } = await hastaCta(orch, "v4-asesor-nutricion");
      await turnPresupuesto("p4", "Fuera de presupuesto", "accion.fuera_presupuesto");
      const cierre = await turnPresupuesto("p5", "200-250 mil", "presupuesto.r200_250");
      expect(cierre.estadoBot).toBe("activo");
      const duda = await turnPresupuesto("p6", "dress code");
      expect(duda.ruta).toBe("rag");
      await store.update(duda.conversacionId, {
        estadoBot: "humano",
        asesorLockId: "asesor-1",
      });
      return turnPresupuesto("p7", "tienen capilla");
    })();

    for (const despues of [visita, presupuesto]) {
      expect(despues.ruta).toBe("silencio");
      expect(despues.estadoBot).toBe("humano");
      expect(despues.textoRespuesta).not.toContain("capilla");
      const persisted = await store.findById(despues.conversacionId);
      expect(persisted?.estadoBot).toBe("humano");
      expect(persisted?.asesorLockId).toBe("asesor-1");
    }
    expect(llamadas).toBe(2);
    const comercial = await store.findById(antes.conversacionId);
    expect(comercial?.cola).toBe("comercial");
  });
});
