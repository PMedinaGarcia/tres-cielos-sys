import { STORAGE_KEYS, STORAGE_PREFIXES } from "./storage-prefixes";

describe("storage prefixes", () => {
  it("usa prefijos fijos del pipeline RAG", () => {
    expect(STORAGE_PREFIXES.conocimiento).toBe("conocimiento");
    expect(STORAGE_PREFIXES.adjuntoCanal).toBe("adjunto_canal");
    expect(STORAGE_PREFIXES.guion).toBe("guion");
    expect(STORAGE_PREFIXES.catalogo).toBe("catalogo");
    expect(STORAGE_KEYS.guionPaqueteBodas).toBe(
      "guion/paquete-bodas-2027.pdf",
    );
  });
});
