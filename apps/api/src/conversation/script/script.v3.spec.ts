import { ScriptService } from "./script.service";
import { flowConfig } from "../__tests__/flow-config";
import type { ConversacionState } from "../types";
import { COPY_V2_B1, COPY_V2_B3, COPY_V2_FECHA_ANOTADA, COPY_V2_FECHA_CON_NOMBRE, COPY_V2_AFORO_RETRY, COPY_V3_B2_RANGO } from "./script-v2.copy";

function baseConv(overrides?: Partial<ConversacionState>): ConversacionState {
  return {
    id: "c1",
    canal: "whatsapp",
    externalThreadId: "t1",
    estadoBot: "activo",
    pasoGuion: "nombre_fecha",
    camposCapturados: { tipoEvento: "boda" },
    paqueteTentativoId: null,
    ultimaRuta: null,
    motivoHandoff: null,
    escaladoEn: null,
    oportunidadId: "o1",
    brief: {},
    calificado: false,
    listoParaCotizar: false,
    mensajes: [],
    creadoEn: new Date().toISOString(),
    actualizadoEn: new Date().toISOString(),
    ...overrides,
  };
}

describe("ScriptService v3", () => {
  const script = new ScriptService(undefined, flowConfig("v3"));

  it("B1 pide nombre y fecha", async () => {
    const r = await script.handleTurn(baseConv(), "Hola");
    expect(r.pasoGuion).toBe("nombre_fecha");
    expect(r.textoRespuesta).toBe(COPY_V2_B1);
  });

  it("con solo fecha confirma febrero de 2027 y pide el nombre", async () => {
    const r = await script.handleTurn(baseConv(), "Es en Febrero 2027");
    expect(r.camposCapturados.fechaTentativa).toEqual({
      tipo: "mes",
      mes: 2,
      anio: 2027,
      flexible: true,
    });
    expect(r.pasoGuion).toBe("nombre_fecha");
    expect(r.textoRespuesta).toBe(COPY_V2_FECHA_ANOTADA("febrero de 2027"));
    expect(r.textoRespuesta).not.toMatch(/fecha o temporada/);
    expect(r.camposCapturados.numeroMensajesCaptura).toBe(0);
  });

  it("con nombre y sin fecha pide solo la fecha", async () => {
    const r = await script.handleTurn(baseConv(), "Soy Ana");
    expect(r.camposCapturados.nombre?.toLowerCase()).toContain("ana");
    expect(r.pasoGuion).toBe("nombre_fecha");
    expect(r.textoRespuesta).toBe(
      COPY_V2_FECHA_CON_NOMBRE(r.camposCapturados.nombre as string),
    );
    expect(r.camposCapturados.numeroMensajesCaptura).toBe(0);
  });

  it("febrero 27 con nombre es febrero de 2027 y avanza", async () => {
    const r = await script.handleTurn(
      baseConv({
        camposCapturados: {
          tipoEvento: "boda",
          nombre: "Patricio Medina",
        },
      }),
      "febrero 27",
    );
    expect(r.camposCapturados.fechaTentativa).toEqual({
      tipo: "mes",
      mes: 2,
      anio: 2027,
      flexible: true,
    });
    expect(r.pasoGuion).toBe("aforo_inversion");
    expect(r.textoRespuesta).toMatch(/cuántas personas/);
    expect(r.textoRespuesta).not.toMatch(/día, mes y año/i);
    expect(r.textoRespuesta).not.toMatch(/250/);
  });

  it("tres turnos sin slot nuevo llegan a 3; un turno con fecha reinicia", async () => {
    const t1 = await script.handleTurn(baseConv(), "Hola");
    expect(t1.camposCapturados.numeroMensajesCaptura).toBe(1);

    const t2 = await script.handleTurn(
      baseConv({
        pasoGuion: t1.pasoGuion,
        camposCapturados: t1.camposCapturados,
      }),
      "ok",
    );
    expect(t2.camposCapturados.numeroMensajesCaptura).toBe(2);

    const t3 = await script.handleTurn(
      baseConv({
        pasoGuion: t2.pasoGuion,
        camposCapturados: t2.camposCapturados,
      }),
      "ok",
    );
    expect(t3.camposCapturados.numeroMensajesCaptura).toBe(3);

    const t4 = await script.handleTurn(
      baseConv({
        pasoGuion: t3.pasoGuion,
        camposCapturados: t3.camposCapturados,
      }),
      "Es en Febrero 2027",
    );
    expect(t4.camposCapturados.numeroMensajesCaptura).toBe(0);
    expect(t4.textoRespuesta).toBe(COPY_V2_FECHA_ANOTADA("febrero de 2027"));
  });

  it("B2 pregunta solo rango si ya hay aforo", async () => {
    const r = await script.handleTurn(
      baseConv({
        pasoGuion: "aforo_inversion",
        camposCapturados: {
          nombre: "Ana",
          tipoEvento: "boda",
          fechaTentativa: { tipo: "mes", mes: 12, anio: 2027, flexible: true },
          aforo: 150,
        },
      }),
      "ok",
    );
    expect(r.textoRespuesta).toBe(COPY_V3_B2_RANGO("Ana"));
    expect(r.textoRespuesta).not.toMatch(/cuántas personas/);
  });

  it("con rango confirmado pide aforo si falta", async () => {
    const r = await script.handleTurn(
      baseConv({
        pasoGuion: "aforo_inversion",
        camposCapturados: {
          nombre: "Ana",
          tipoEvento: "boda",
          fechaTentativa: { tipo: "dia", fecha: "2027-12-22", flexible: false },
          rangoInversion: "r350_499",
        },
      }),
      "ok",
    );
    expect(r.pasoGuion).toBe("aforo_inversion");
    expect(r.textoRespuesta).toBe(COPY_V2_AFORO_RETRY);
  });

  it("con aforo y rango confirmado avanza a accion", async () => {
    const r = await script.handleTurn(
      baseConv({
        pasoGuion: "aforo_inversion",
        camposCapturados: {
          nombre: "Ana",
          tipoEvento: "boda",
          fechaTentativa: { tipo: "dia", fecha: "2027-12-22", flexible: false },
          aforo: 150,
          rangoInversion: "r350_499",
        },
      }),
      "ok",
    );
    expect(r.pasoGuion).toBe("accion");
    expect(r.textoRespuesta).toBe("");
  });

  it("por_definir sin aforo pide aforo; con aforo abre B3", async () => {
    const sinAforo = await script.handleTurn(
      baseConv({
        pasoGuion: "aforo_inversion",
        camposCapturados: {
          nombre: "Ana",
          tipoEvento: "boda",
          fechaTentativa: { tipo: "mes", mes: 2, anio: 2027, flexible: true },
        },
      }),
      "aún por definir",
    );
    expect(sinAforo.pasoGuion).toBe("aforo_inversion");
    expect(sinAforo.textoRespuesta).toBe(COPY_V2_AFORO_RETRY);

    const r = await script.handleTurn(
      baseConv({
        pasoGuion: "aforo_inversion",
        camposCapturados: {
          nombre: "Ana",
          tipoEvento: "boda",
          fechaTentativa: { tipo: "mes", mes: 2, anio: 2027, flexible: true },
          aforo: 150,
        },
      }),
      "aún por definir",
    );
    expect(r.pasoGuion).toBe("aclaracion_piso");
    expect(r.textoRespuesta).toBe(COPY_V2_B3);
  });
});
