import {
  FIXTURE_SEDE_TEQUESQUITENGO,
  buildKnowledgeFixtures,
} from "../../../src/rag/fixtures/knowledge-fixtures";

/** Espejo de fixtures bajo test/fixtures/knowledge (D5). */
describe("Knowledge fixtures K01/K02/K08/K09 (D5)", () => {
  const fixtures = buildKnowledgeFixtures();

  it("incluye inventarios K01, K02, K08, K09 recuperables", () => {
    const ids = new Set(
      fixtures
        .filter((f) => f.activo && f.documentoEstado === "publicado")
        .map((f) => f.inventarioId),
    );
    expect(ids.has("K01")).toBe(true);
    expect(ids.has("K02")).toBe(true);
    expect(ids.has("K08")).toBe(true);
    expect(ids.has("K09")).toBe(true);
  });

  it("K02 está acotado a sede Tequesquitengo", () => {
    const k02 = fixtures.filter((f) => f.inventarioId === "K02" && f.activo);
    expect(k02.every((f) => f.sedeId === FIXTURE_SEDE_TEQUESQUITENGO)).toBe(true);
  });

  it("K01 global publica dirección; K02 no usa copy sintético de visitas", () => {
    const k01 = fixtures.find((f) => f.id === "frag-k01-ubicacion")!;
    expect(k01.sedeId).toBeNull();
    expect(k01.texto).toMatch(/Lote 36/);
    expect(k01.texto).toMatch(/62915/);
    expect(k01.texto).toMatch(/Bajada 6/);

    const corpus = fixtures
      .filter((f) => f.activo && f.documentoEstado === "publicado")
      .map((f) => f.texto)
      .join("\n");
    expect(corpus).not.toMatch(/11:00 a 18:00/);
    expect(corpus).not.toMatch(/polo de eventos/);
  });

  it("K09 aporta copy safe institucional", () => {
    const k09 = fixtures.find((f) => f.id === "frag-k09-safe")!;
    expect(k09.texto.toLowerCase()).toContain("asesor");
    expect(k09.pipelineEstado).toBe("listo");
  });
});
