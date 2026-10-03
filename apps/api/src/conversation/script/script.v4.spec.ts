import { ScriptService } from "./script.service";
import { flowConfig } from "../__tests__/flow-config";
import type { ConversacionState } from "../types";
import {
  COPY_V4_B1,
  COPY_V4_B1_RETRY,
  COPY_V4_CTA_RETRY,
  COPY_V4_NOMBRE,
  COPY_V4_PDF,
  COPY_V4_PRESUPUESTO_FUERA,
} from "./script-v4.copy";

function baseConv(overrides?: Partial<ConversacionState>): ConversacionState {
  return {
    id: "c1",
    canal: "whatsapp",
    externalThreadId: "t1",
    estadoBot: "activo",
    pasoGuion: "fecha_ventana",
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
    guionVersion: "v4",
    ...overrides,
  };
}

describe("ScriptService v4", () => {
  const script = new ScriptService(undefined, flowConfig("v4"));

  it("Hola → saludo con selección de temporada; repetir → retry", async () => {
    const t1 = await script.handleTurn(baseConv(), "Hola");
    expect(t1.pasoGuion).toBe("fecha_ventana");
    expect(t1.textoRespuesta).toBe(COPY_V4_B1);
    const t2 = await script.handleTurn(
      baseConv({ camposCapturados: t1.camposCapturados }),
      "Hola",
    );
    expect(t2.textoRespuesta).toBe(COPY_V4_B1_RETRY);
  });

  it("ventana Jun-Sep ancla al año de tarifa y pide el nombre", async () => {
    const r = await script.handleTurn(baseConv(), "Jun-Sep");
    expect(r.camposCapturados.fechaTentativa).toEqual({
      tipo: "rango",
      desde: "2027-06-01",
      hasta: "2027-09-30",
      anio: 2027,
      flexible: true,
    });
    expect(r.camposCapturados.fechaEstado).toBe("ventana");
    expect(r.pasoGuion).toBe("nombre");
    expect(r.textoRespuesta).toBe(COPY_V4_NOMBRE);
  });

  it("2028 cubre todo el año", async () => {
    const r = await script.handleTurn(baseConv(), "2028");
    expect(r.camposCapturados.fechaTentativa).toMatchObject({
      desde: "2028-01-01",
      hasta: "2028-12-31",
    });
  });

  it("Patricio con el paso revertido a la fecha igual abre el PDF", async () => {
    const conv = baseConv({
      pasoGuion: "fecha_ventana",
      camposCapturados: {
        tipoEvento: "boda",
        fechaTentativa: {
          tipo: "rango",
          desde: "2027-06-01",
          hasta: "2027-09-30",
          anio: 2027,
          flexible: true,
        },
      },
    });
    const r = await script.handleTurn(conv, "Patricio");
    expect(r.camposCapturados.nombre).toBe("Patricio");
    expect(r.pasoGuion).toBe("accion");
    expect(r.textoRespuesta).toBe(COPY_V4_PDF("Patricio"));
  });

  it("nombre → PDF personalizado y paso accion", async () => {
    const conv = baseConv({
      pasoGuion: "nombre",
      camposCapturados: {
        tipoEvento: "boda",
        fechaTentativa: {
          tipo: "rango",
          desde: "2027-10-01",
          hasta: "2027-12-31",
          flexible: true,
        },
      },
    });
    const r = await script.handleTurn(conv, "Ana");
    expect(r.camposCapturados.nombre).toBe("Ana");
    expect(r.pasoGuion).toBe("accion");
    expect(r.textoRespuesta).toBe(COPY_V4_PDF("Ana"));
    expect(r.adjuntoGuion).toBe("paquete-bodas-2027");
  });

  it("en accion sin CTA re-pregunta sin reenviar PDF; con CTA cierra el guion", async () => {
    const campos = {
      tipoEvento: "boda",
      nombre: "Ana",
      pdfEnviado: true,
      fechaTentativa: {
        tipo: "rango" as const,
        desde: "2027-10-01",
        hasta: "2027-12-31",
        flexible: true,
      },
    };
    const retry = await script.handleTurn(
      baseConv({ pasoGuion: "accion", camposCapturados: campos }),
      "mmm",
    );
    expect(retry.textoRespuesta).toBe(COPY_V4_CTA_RETRY);
    expect(retry.adjuntoGuion).toBeUndefined();

    const cta = await script.handleTurn(
      baseConv({ pasoGuion: "accion", camposCapturados: campos }),
      "accion.fuera_presupuesto",
    );
    expect(cta.camposCapturados.ctaGuion).toBe("fuera_presupuesto");
    expect(cta.camposCapturados.encajeEconomico).toBe("no");
    expect(cta.pasoGuion).toBe("presupuesto_fuera");
    expect(cta.textoRespuesta).toBe(COPY_V4_PRESUPUESTO_FUERA);
    expect(cta.guionCompleto).toBe(false);

    const rango = await script.handleTurn(
      baseConv({
        pasoGuion: "presupuesto_fuera",
        camposCapturados: cta.camposCapturados,
      }),
      "presupuesto.r250_300",
    );
    expect(rango.camposCapturados.rangoPresupuestoFuera).toBe("r250_300");
    expect(rango.guionCompleto).toBe(true);
  });
});
