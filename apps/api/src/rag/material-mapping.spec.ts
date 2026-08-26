import {
  mimeToPrismaTipoMaterial,
  parsePgVector,
  toPgVectorLiteral,
  toPrismaOrigen,
  toRagTipoMaterial,
} from "./material-mapping";

describe("material-mapping", () => {
  it("mapea MIME y enums Prisma ↔ RAG", () => {
    expect(mimeToPrismaTipoMaterial("application/pdf")).toBe("pdf");
    expect(mimeToPrismaTipoMaterial("image/jpeg")).toBe("imagen");
    expect(toRagTipoMaterial("faq", "pdf")).toBe("faq");
    expect(toRagTipoMaterial("ficha_sede", "docx")).toBe("word");
    expect(toRagTipoMaterial(null, "imagen")).toBe("foto");
    expect(toPrismaOrigen("nativo")).toBe("texto_nativo");
  });

  it("serializa y parsea literales pgvector", () => {
    expect(toPgVectorLiteral([1, 0.5, 0])).toBe("[1,0.5,0]");
    expect(parsePgVector("[1, 2, 3]")).toEqual([1, 2, 3]);
    expect(parsePgVector(null)).toEqual([]);
  });
});
