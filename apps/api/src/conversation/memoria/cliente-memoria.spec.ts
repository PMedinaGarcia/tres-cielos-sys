import { ConversationStoreService } from "../stubs/conversation-store.service";
import { NurtureWorkerService } from "../nurture/nurture.worker";
import type { ConversacionState } from "../types";
import { ClienteMemoriaService } from "./cliente-memoria.service";
import {
  canonicalCamposJson,
  mergeCampos,
  resumeGreeting,
} from "./cliente-memoria.logic";

const TEL = "+5215512345678";

function state(
  overrides: Partial<ConversacionState> = {},
): ConversacionState {
  return {
    id: overrides.id ?? "conv-1",
    canal: overrides.canal ?? "whatsapp",
    externalThreadId: overrides.externalThreadId ?? `wa:${TEL}`,
    estadoBot: "activo",
    pasoGuion: "fecha_ventana",
    paqueteTentativoId: null,
    ultimaRuta: null,
    motivoHandoff: null,
    escaladoEn: null,
    oportunidadId: "opp-1",
    brief: {},
    calificado: false,
    listoParaCotizar: false,
    mensajes: [],
    creadoEn: new Date().toISOString(),
    actualizadoEn: new Date().toISOString(),
    ...overrides,
    camposCapturados: {
      telefono: TEL,
      tipoEvento: "boda",
      ...overrides.camposCapturados,
    },
  };
}

describe("memoria por cliente", () => {
  it("un campo vacío no borra el nombre ni el tipo de evento ya capturado", () => {
    const merged = mergeCampos(
      {
        nombre: "Ana López",
        tipoEvento: "xv",
        telefono: TEL,
        ctaGuion: "visita",
      },
      { nombre: null, tipoEvento: "boda", aforo: 120, ctaGuion: null },
    );
    expect(merged.nombre).toBe("Ana López");
    expect(merged.tipoEvento).toBe("xv");
    expect(merged.aforo).toBe(120);
    expect(merged.ctaGuion).toBe("visita");
  });

  it("el JSON canónico persiste CTA y rango fuera de presupuesto", () => {
    const json = canonicalCamposJson({
      ctaGuion: "fuera_presupuesto",
      rangoPresupuestoFuera: "r250_300",
      nombre: "Ana",
    });
    expect(json.ctaGuion).toBe("fuera_presupuesto");
    expect(json.rangoPresupuestoFuera).toBe("r250_300");
  });

  it("otro canal del mismo teléfono hereda paso, slots y oportunidad", async () => {
    const memoria = new ClienteMemoriaService();
    const wa = state({
      pasoGuion: "accion",
      camposCapturados: {
        nombre: "Ana",
        fechaTentativa: { tipo: "dia", fecha: "2026-12-12", flexible: false },
        ctaGuion: "fuera_presupuesto",
        rangoPresupuestoFuera: "r200_250",
      },
    });
    await memoria.aplicar(wa);
    memoria.commitFromState(wa);

    const ig = state({
      id: "conv-ig",
      canal: "instagram",
      externalThreadId: "ig-ana",
      pasoGuion: "fecha_ventana",
      oportunidadId: "opp-nueva",
      camposCapturados: { telefono: TEL },
    });
    await memoria.aplicar(ig);

    expect(ig.camposCapturados.nombre).toBe("Ana");
    expect(ig.camposCapturados.fechaTentativa?.fecha).toBe("2026-12-12");
    expect(ig.camposCapturados.rangoPresupuestoFuera).toBe("r200_250");
    expect(ig.pasoGuion).toBe("accion");
    expect(ig.oportunidadId).toBe("opp-1");
  });

  it("al reiniciar el store el perfil sigue en la memoria del cliente", async () => {
    const memoria = new ClienteMemoriaService();
    const store = new ConversationStoreService(undefined, undefined, memoria);
    const conv = await store.resolveOrCreate({
      canal: "whatsapp",
      externalThreadId: `wa:${TEL}`,
    });
    await store.update(conv.id, {
      pasoGuion: "presupuesto_fuera",
      camposCapturados: {
        ...conv.camposCapturados,
        nombre: "Ana",
        rangoPresupuestoFuera: "fuera_rango",
      },
    });
    store.clear();

    const restarted = new ConversationStoreService(undefined, undefined, memoria);
    const again = await restarted.resolveOrCreate({
      canal: "whatsapp",
      externalThreadId: `wa:${TEL}`,
    });
    expect(again.pasoGuion).toBe("presupuesto_fuera");
    expect(again.camposCapturados.nombre).toBe("Ana");
    expect(again.camposCapturados.rangoPresupuestoFuera).toBe("fuera_rango");
    expect(again.oportunidadId).toBe(conv.oportunidadId);
  });

  it("saluda de nuevo y deja el paso donde se quedó si pasaron 12 horas", async () => {
    const memoria = new ClienteMemoriaService();
    const first = state({ pasoGuion: "nombre", camposCapturados: { nombre: "Ana" } });
    await memoria.aplicar(first, { now: new Date("2026-10-01T10:00:00.000Z") });
    memoria.commitFromState(first, new Date("2026-10-01T10:00:00.000Z"));

    const soon = state({ id: "conv-soon", pasoGuion: "saludo" });
    await memoria.aplicar(soon, { now: new Date("2026-10-01T12:00:00.000Z") });
    expect(soon.reanudarSesion).toBe(false);
    expect(soon.pasoGuion).toBe("nombre");

    const later = state({ id: "conv-later", pasoGuion: "saludo" });
    await memoria.aplicar(later, { now: new Date("2026-10-02T10:00:00.000Z") });
    expect(later.reanudarSesion).toBe(true);
    expect(later.pasoGuion).toBe("nombre");
    expect(
      resumeGreeting({
        nombre: later.camposCapturados.nombre,
        pasoGuion: later.pasoGuion,
        campos: later.camposCapturados,
      }),
    ).toMatch(/Hola de nuevo, Ana/);
  });

  it("guarda el mensaje del cliente mientras el bot está en silencio", async () => {
    const memoria = new ClienteMemoriaService();
    const wa = state({ estadoBot: "humano", pasoGuion: "accion" });
    await memoria.aplicar(wa);
    memoria.commitFromState(wa);
    await memoria.recordHumanInbound({
      canal: "whatsapp",
      externalThreadId: `wa:${TEL}`,
      texto: "sigo esperando al asesor",
      telefono: TEL,
    });
    const perfil = memoria.perfilDe(wa);
    expect(perfil?.estadoBot).toBe("humano");
    expect(perfil?.resumen).toMatch(/asesor/);
    expect(perfil?.resumen).toMatch(/sigo esperando/);
    expect(perfil?.pasoGuion).toBe("accion");
  });

  it("dos turnos concurrentes del mismo cliente conservan ambos campos", async () => {
    const memoria = new ClienteMemoriaService();
    await Promise.all([
      (async () => {
        const left = state({ id: "a", camposCapturados: { nombre: "Ana" } });
        await memoria.aplicar(left);
        left.camposCapturados = { ...left.camposCapturados, nombre: "Ana" };
        memoria.commitFromState(left);
      })(),
      (async () => {
        const right = state({
          id: "b",
          canal: "sandbox",
          externalThreadId: "5512345678",
          oportunidadId: "opp-b",
          camposCapturados: { aforo: 180 },
        });
        await memoria.aplicar(right);
        right.camposCapturados = { ...right.camposCapturados, aforo: 180 };
        memoria.commitFromState(right);
      })(),
    ]);
    const perfil = memoria.perfilDe(state());
    expect(perfil?.campos.nombre).toBe("Ana");
    expect(perfil?.campos.aforo).toBe(180);
    expect(perfil?.oportunidadAbiertaId).toBe("opp-1");
  });

  it("la nutrición sobrevive a un worker nuevo", () => {
    const memoria = new ClienteMemoriaService();
    const now = new Date("2026-10-01T00:00:00.000Z");
    const first = new NurtureWorkerService(undefined, memoria);
    first.schedule({
      conversacionId: "c1",
      nombre: "Ana",
      consentimiento: true,
      now,
    });
    const restarted = new NurtureWorkerService(undefined, memoria);
    const due = restarted.processDue(new Date("2026-10-02T01:00:00.000Z"));
    expect(due).toHaveLength(1);
    expect(due[0]!.job.toque).toBe(1);
    expect(due[0]!.texto).toMatch(/Ana/);
    expect(restarted.processDue(new Date("2026-10-02T02:00:00.000Z"))).toHaveLength(0);
  });
});
