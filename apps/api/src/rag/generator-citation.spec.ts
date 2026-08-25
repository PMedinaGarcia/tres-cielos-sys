import { Test, TestingModule } from "@nestjs/testing";
import { FakeLlmPort } from "../ports/__fakes__";
import { LLM_PORT } from "../ports/tokens";
import { stripMontos, textoContieneMontos } from "./anti-hallucination.util";
import { hasCitaTipada } from "./citation.util";
import { buildKnowledgeFixtures } from "./fixtures/knowledge-fixtures";
import { GeneratorService } from "./generator.service";
import { RerankedCandidate } from "./types";

function asReranked(id: string, score = 0.9): RerankedCandidate {
  const fragmento = buildKnowledgeFixtures().find((f) => f.id === id)!;
  return {
    fragmento,
    scoreHybrid: 0.7,
    scoreRerank: score,
    origenRama: "ambos",
  };
}

describe("GeneratorService (D3)", () => {
  let generator: GeneratorService;
  let llm: FakeLlmPort;

  beforeEach(async () => {
    llm = new FakeLlmPort();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: LLM_PORT, useValue: llm },
        GeneratorService,
      ],
    }).compile();
    generator = module.get(GeneratorService);
  });

  it("valida cita [Fuente: nombre | tipo: tipo_material]", async () => {
    llm.setFixture(
      "Horarios",
      "Martes a sábado 11:00 a 18:00.\n[Fuente: K01-faq-general.pdf | tipo: faq]",
    );
    const result = await generator.generate({
      query: "¿Horarios?",
      fragments: [asReranked("frag-k01-horarios")],
    });
    expect(result.ok).toBe(true);
    expect(hasCitaTipada(result.texto!)).toBe(true);
    expect(result.cita).toContain("K01-faq-general.pdf");
    expect(result.cita).toContain("tipo: faq");
  });

  it("sin cita → handoff sin_cita_rag", async () => {
    llm.setFixture("Horarios", "Según el material: martes a sábado.");
    const result = await generator.generate({
      query: "¿Horarios?",
      fragments: [asReranked("frag-k01-horarios")],
    });
    expect(result.ok).toBe(false);
    expect(result.motivoHandoff).toBe("sin_cita_rag");
  });

  it("no_recuperable_precio: prosa OK, montos strippeados", async () => {
    llm.setFixture(
      "cartel",
      "El cartel menciona $85,000 MXN como referencia.\n[Fuente: tarjeta-precios.jpg | tipo: foto]",
    );
    const result = await generator.generate({
      query: "¿Qué dice el cartel?",
      fragments: [asReranked("frag-tarifa-ocr", 0.9)],
    });
    expect(result.ok).toBe(true);
    expect(textoContieneMontos(result.texto!)).toBe(false);
    expect(result.montosEliminados).toBe(true);
    expect(hasCitaTipada(result.texto!)).toBe(true);
  });

  it("stripMontos helper", () => {
    const raw = "Cuesta $85,000 MXN el fin de semana";
    expect(textoContieneMontos(raw)).toBe(true);
    expect(textoContieneMontos(stripMontos(raw))).toBe(false);
  });
});
