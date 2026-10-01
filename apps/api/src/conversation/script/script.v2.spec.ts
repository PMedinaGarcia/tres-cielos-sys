import { ScriptService } from "./script.service";
import { flowConfig } from "../__tests__/flow-config";
import type { ConversacionState } from "../types";
import { GUION_ADJUNTO_PAQUETE_BODAS } from "@tres-cielos/shared";
import {
  COPY_V2_B1,
  COPY_V2_FECHA_ANOTADA,
  COPY_V2_FECHA_CON_NOMBRE,
} from "./script-v2.copy";
import { COPY_V4_PDF } from "./script-v4.copy";

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

describe("ScriptService v2", () => {
  const script = new ScriptService(undefined, flowConfig("v2"));

  it("B1 pide nombre y fecha asumiendo boda", async () => {
    const r = await script.handleTurn(baseConv(), "Hola");
    expect(r.pasoGuion).toBe("nombre_fecha");
    expect(r.textoRespuesta).toBe(COPY_V2_B1);
    expect(r.adjuntoGuion).toBeUndefined();
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
    expect(r.pasoGuion).toBe("accion");
    expect(r.textoRespuesta).toBe(COPY_V4_PDF("Patricio Medina"));
    expect(r.adjuntoGuion).toBe(GUION_ADJUNTO_PAQUETE_BODAS);
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
    expect(t2.pasoGuion).toBe("nombre_fecha");

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
    expect(t4.pasoGuion).toBe("nombre_fecha");
  });

  it("con nombre y fecha envía paquete comercial (sin aforo)", async () => {
    const r = await script.handleTurn(
      baseConv(),
      "Soy Ana, boda el 22 de diciembre de 2027",
    );
    expect(r.camposCapturados.nombre?.toLowerCase()).toContain("ana");
    expect(r.pasoGuion).toBe("accion");
    expect(r.textoRespuesta).toBe(COPY_V4_PDF("Ana"));
    expect(r.adjuntoGuion).toBe(GUION_ADJUNTO_PAQUETE_BODAS);
    expect(r.textoRespuesta).toMatch(/PDF/);
    expect(r.textoRespuesta).not.toMatch(/cuántas personas/);
  });

  it("tras captura completa en accion puede corregir tipo y aforo en harvest", async () => {
    const r = await script.handleTurn(
      baseConv({
        pasoGuion: "accion",
        camposCapturados: {
          nombre: "Ana",
          tipoEvento: "boda",
          fechaTentativa: { tipo: "dia", fecha: "2027-12-22", flexible: false },
          pdfEnviado: true,
        },
      }),
      "en realidad es un xv para 120 invitados",
    );
    expect(r.camposCapturados.tipoEvento).toBe("xv");
    expect(r.camposCapturados.nombre).toBe("Ana");
    expect(r.camposCapturados.aforo).toBe(120);
  });
});
