import { MOTIVO_HANDOFF_VALUES, isMotivoHandoff } from "./motivo-handoff";

describe("MotivoHandoff (A5)", () => {
  it("incluye motivos media/IA", () => {
    expect(MOTIVO_HANDOFF_VALUES).toEqual(
      expect.arrayContaining([
        "adjunto_no_soportado",
        "material_ocr_tarifas",
        "proveedor_ia",
        "cupo_ia",
        "solicitud_usuario",
        "rerank_bajo",
      ]),
    );
  });

  it("valida miembros del enum", () => {
    expect(isMotivoHandoff("proveedor_ia")).toBe(true);
    expect(isMotivoHandoff("no_existe")).toBe(false);
  });
});
