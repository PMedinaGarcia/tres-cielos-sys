import {
  HABLAR_ASESOR_PAYLOAD,
  HABLAR_ASESOR_TEXTO,
  WA_LIST_ITEM_TITLE_MAX,
} from "@tres-cielos/shared";
import {
  ACCION_CTA_ITEMS,
  FECHA_VENTANA_ITEMS,
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

  it("todos los items v4 tienen texto canónico y títulos dentro del límite WA", () => {
    for (const item of [...FECHA_VENTANA_ITEMS, ...ACCION_CTA_ITEMS]) {
      expect(WA_PAYLOAD_TEXTO[item.id]).toBeTruthy();
      expect(item.title.length).toBeLessThanOrEqual(WA_LIST_ITEM_TITLE_MAX);
    }
  });

  it("sin payload deja el texto intacto", () => {
    expect(resolveInteractiveInbound({ texto: "Patricio Medina" })).toEqual({
      texto: "Patricio Medina",
    });
  });
});
