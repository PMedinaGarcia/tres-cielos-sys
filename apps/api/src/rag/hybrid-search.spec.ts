import { ConfigModule } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";
import { FakeEmbeddingsPort } from "../ports/__fakes__";
import { EMBEDDINGS_PORT } from "../ports/tokens";
import {
  FIXTURE_SEDE_TEQUESQUITENGO,
  buildKnowledgeFixtures,
} from "./fixtures/knowledge-fixtures";
import { HybridSearchService, fuseAndDedupe } from "./hybrid-search.service";
import { InMemoryFragmentRepository } from "./in-memory-fragment.repository";
import { FRAGMENT_REPOSITORY } from "./tokens";

describe("HybridSearchService (D1)", () => {
  let hybrid: HybridSearchService;
  let fragments: InMemoryFragmentRepository;

  beforeEach(async () => {
    fragments = new InMemoryFragmentRepository();
    fragments.replaceAll(buildKnowledgeFixtures());

    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [
        { provide: EMBEDDINGS_PORT, useValue: new FakeEmbeddingsPort() },
        { provide: FRAGMENT_REPOSITORY, useValue: fragments },
        HybridSearchService,
      ],
    }).compile();

    hybrid = module.get(HybridSearchService);
  });

  it("fusiona vector+FTS, dedupe, y recorta a top ≤ 20", async () => {
    const hits = await hybrid.search("horario visitas jardín", {
      sedeId: FIXTURE_SEDE_TEQUESQUITENGO,
      topN: 15,
    });

    expect(hits.length).toBeGreaterThan(0);
    expect(hits.length).toBeLessThanOrEqual(15);

    const ids = hits.map((h) => h.fragmento.id);
    expect(new Set(ids).size).toBe(ids.length);

    const horarios = hits.find((h) => h.fragmento.id.includes("horario"));
    expect(horarios).toBeDefined();
  });

  it("filtros duros: excluye inactivo, no publicado y pipeline ≠ listo", async () => {
    const hits = await hybrid.search("horario secreto pipeline borrador", {
      sedeId: FIXTURE_SEDE_TEQUESQUITENGO,
    });
    const ids = new Set(hits.map((h) => h.fragmento.id));
    expect(ids.has("frag-borrador")).toBe(false);
    expect(ids.has("frag-pipeline-pendiente")).toBe(false);
    expect(ids.has("frag-inactivo")).toBe(false);
  });

  it("sede: globales + sede lead; sin sede solo globales", async () => {
    const withSede = await hybrid.search("capacidad jardín invitados", {
      sedeId: FIXTURE_SEDE_TEQUESQUITENGO,
    });
    expect(withSede.some((h) => h.fragmento.inventarioId === "K02")).toBe(true);

    const globalOnly = await hybrid.search("venue jardín Tres Cielos", {
      sedeId: null,
    });
    expect(globalOnly.every((h) => h.fragmento.sedeId == null)).toBe(true);
    expect(globalOnly.some((h) => h.fragmento.inventarioId === "K02")).toBe(
      false,
    );
  });

  it("fuseAndDedupe marca origen ambos cuando hay hit vector+fts", () => {
    const frag = buildKnowledgeFixtures()[0]!;
    const fused = fuseAndDedupe(
      [{ fragmento: frag, score: 0.8 }],
      [{ fragmento: frag, score: 0.6 }],
      10,
    );
    expect(fused).toHaveLength(1);
    expect(fused[0]!.origenRama).toBe("ambos");
    expect(fused[0]!.scoreHybrid).toBe(0.8);
  });

  it("corpusIds restringe el inventario K recuperable", async () => {
    const hits = await hybrid.search("venue jardín Tres Cielos", {
      sedeId: null,
      corpusIds: ["K01"],
    });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((h) => h.fragmento.inventarioId === "K01")).toBe(true);
  });
});
