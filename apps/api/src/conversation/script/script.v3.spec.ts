import { GUION_ADJUNTO_PAQUETE_BODAS } from "@tres-cielos/shared";
import { ScriptService } from "./script.service";
import { flowConfig } from "../__tests__/flow-config";
import type { ConversacionState } from "../types";
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
  });

  it("con nombre y fecha envía paquete comercial sin aforo", async () => {
    const r = await script.handleTurn(
      baseConv(),
      "Soy Ana, boda el 22 de diciembre de 2027",
    );
    expect(r.pasoGuion).toBe("accion");
    expect(r.textoRespuesta).toBe(COPY_V4_PDF("Ana"));
    expect(r.adjuntoGuion).toBe(GUION_ADJUNTO_PAQUETE_BODAS);
  });

  it("con nombre y sin fecha pide solo la fecha", async () => {
    const r = await script.handleTurn(baseConv(), "Soy Ana");
    expect(r.camposCapturados.nombre?.toLowerCase()).toContain("ana");
    expect(r.pasoGuion).toBe("nombre_fecha");
    expect(r.textoRespuesta).toBe(
      COPY_V2_FECHA_CON_NOMBRE(r.camposCapturados.nombre as string),
    );
  });
});
