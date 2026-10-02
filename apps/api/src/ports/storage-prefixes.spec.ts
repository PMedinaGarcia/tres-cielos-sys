import { STORAGE_KEYS, STORAGE_PREFIXES } from "./storage-prefixes";

describe("storage prefixes", () => {
  it("usa prefijos fijos del pipeline RAG", () => {
    expect(STORAGE_PREFIXES.conocimiento).toBe("conocimiento");
    expect(STORAGE_PREFIXES.adjuntoCanal).toBe("adjunto_canal");
    expect(STORAGE_PREFIXES.guion).toBe("guion");
    expect(STORAGE_PREFIXES.catalogo).toBe("catalogo");
    expect(STORAGE_KEYS.guionExperienciaBoda).toBe(
      "guion/experiencia-boda-tres-dias-2027.pdf",
    );
    expect(STORAGE_KEYS.guionTarifas2027).toBe(
      "guion/tarifas-2027-tres-cielos.pdf",
    );
  });
});
