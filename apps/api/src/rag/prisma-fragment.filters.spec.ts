import { Prisma } from "@prisma/client";
import { hardFilterSql } from "./prisma-fragment.repository";
import { passesHardFilters } from "./in-memory-fragment.repository";
import { buildKnowledgeFixtures } from "./fixtures/knowledge-fixtures";
import { FIXTURE_SEDE_TEQUESQUITENGO } from "./fixtures/knowledge-fixtures";

describe("filtros duros RAG (sede / publicación)", () => {
  const fixtures = buildKnowledgeFixtures();
  const k02 = fixtures.find((f) => f.inventarioId === "K02" && f.activo)!;
  const k01 = fixtures.find((f) => f.inventarioId === "K01" && f.activo)!;

  it("sin sede solo globales; con sede globales + sede del lead", () => {
    expect(passesHardFilters(k02, { sedeId: null })).toBe(false);
    expect(passesHardFilters(k01, { sedeId: null })).toBe(true);
    expect(
      passesHardFilters(k02, { sedeId: FIXTURE_SEDE_TEQUESQUITENGO }),
    ).toBe(true);
    expect(
      passesHardFilters(k01, { sedeId: FIXTURE_SEDE_TEQUESQUITENGO }),
    ).toBe(true);
  });

  it("SQL Prisma replica sede global vs sede del lead", () => {
    const globalSql = hardFilterSql({ sedeId: null });
    expect(sqlText(globalSql)).toContain("f.sede_id IS NULL");
    const sedeSql = hardFilterSql({
      sedeId: FIXTURE_SEDE_TEQUESQUITENGO,
    });
    expect(sqlText(sedeSql)).toContain("f.sede_id IS NULL OR");
  });
});

function sqlText(sql: Prisma.Sql): string {
  return sql.strings.join("?");
}
