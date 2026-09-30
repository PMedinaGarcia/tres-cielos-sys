import { HABLAR_ASESOR_PAYLOAD, HABLAR_ASESOR_TEXTO } from "@tres-cielos/shared";
import {
  resolveInteractiveInbound,
  WA_PAYLOAD_TEXTO,
} from "../wa-templates.catalog";

describe("resolveInteractiveInbound", () => {
  it("mapea payloads de guion a texto canónico", () => {
    expect(
      resolveInteractiveInbound({
        texto: "Boda",
        buttonPayload: "ocasion.boda",
      }),
    ).toEqual({ texto: "boda", buttonPayload: "ocasion.boda" });
    expect(WA_PAYLOAD_TEXTO["sede.jardin_1"]).toBe(
      "Tres Cielos Tequesquitengo",
    );
    expect(WA_PAYLOAD_TEXTO["intencion.si"]).toBe("sí");
    expect(WA_PAYLOAD_TEXTO["aclaracion.no"]).toBe("Buscamos algo menor");
  });

  it("hablar_asesor usa el texto que matchea el regex humano", () => {
    const r = resolveInteractiveInbound({
      texto: "Hablar con asesor",
      buttonPayload: HABLAR_ASESOR_PAYLOAD,
    });
    expect(r.texto).toBe(HABLAR_ASESOR_TEXTO);
    expect(r.buttonPayload).toBe(HABLAR_ASESOR_PAYLOAD);
  });

  it("sin payload deja el texto intacto", () => {
    expect(resolveInteractiveInbound({ texto: "Patricio Medina" })).toEqual({
      texto: "Patricio Medina",
    });
  });
});
