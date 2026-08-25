import { ConfigModule } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";
import {
  FakeEmbeddingsPort,
  FakeLlmPort,
  FakeRerankPort,
} from "../ports/__fakes__";
import {
  EMBEDDINGS_PORT,
  LLM_PORT,
  RERANK_PORT,
} from "../ports/tokens";
import { hasCitaTipada } from "./citation.util";
import {
  FIXTURE_SEDE_JARDIN_1,
  buildKnowledgeFixtures,
} from "./fixtures/knowledge-fixtures";
import { GeneratorService } from "./generator.service";
import { HybridSearchService } from "./hybrid-search.service";
import { InMemoryFragmentRepository } from "./in-memory-fragment.repository";
import { RagPipelineService } from "./rag-pipeline.service";
import { RegistroRecuperacionService } from "./registro-recuperacion.service";
import { RerankService } from "./rerank.service";
import { FRAGMENT_REPOSITORY } from "./tokens";
import { DEFAULT_RERANK_THRESHOLD, SAFE_COPY_K09 } from "./types";

/** Fija scores: ids listados con valor; resto en floor (evita hash ≥ 0.85). */
function applyScores(
  rerank: FakeRerankPort,
  scores: Record<string, number>,
  floor = 0.1,
): void {
  for (const f of buildKnowledgeFixtures()) {
    rerank.setScore(f.id, scores[f.id] ?? floor);
  }
}

function anchoredReply(nombre: string, tipo: string, body: string): string {
  return `${body}\n[Fuente: ${nombre} | tipo: ${tipo}]`;
}

describe("RagPipeline — rerank threshold (C5)", () => {
  let pipeline: RagPipelineService;
  let registros: RegistroRecuperacionService;
  let llm: FakeLlmPort;
  let rerank: FakeRerankPort;
  let fragments: InMemoryFragmentRepository;

  beforeEach(async () => {
    llm = new FakeLlmPort();
    rerank = new FakeRerankPort(0.85);
    fragments = new InMemoryFragmentRepository();
    fragments.replaceAll(buildKnowledgeFixtures());

    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [
        { provide: LLM_PORT, useValue: llm },
        { provide: EMBEDDINGS_PORT, useValue: new FakeEmbeddingsPort() },
        { provide: RERANK_PORT, useValue: rerank },
        { provide: FRAGMENT_REPOSITORY, useValue: fragments },
        HybridSearchService,
        RerankService,
        GeneratorService,
        RegistroRecuperacionService,
        RagPipelineService,
      ],
    }).compile();

    pipeline = module.get(RagPipelineService);
    registros = module.get(RegistroRecuperacionService);
  });

  it("score ≥ 0.85 → respuesta anclada con cita tipada (D6 / D-BOT-3)", async () => {
    applyScores(rerank, {
      "frag-k01-horarios": 0.91,
      "frag-k02-horario-visitas": 0.88,
    });
    llm.setFixture(
      "horario de visitas",
      anchoredReply(
        "K01-faq-general.pdf",
        "faq",
        "Los horarios comerciales son de martes a sábado de 11:00 a 18:00.",
      ),
    );

    const result = await pipeline.answer(
      "¿Cuál es el horario de visitas del jardín?",
      { sedeId: FIXTURE_SEDE_JARDIN_1 },
    );

    expect(result.ok).toBe(true);
    expect(result.motivoHandoff).toBeUndefined();
    expect(result.scores.length).toBeGreaterThan(0);
    expect(Math.max(...result.scores)).toBeGreaterThanOrEqual(
      DEFAULT_RERANK_THRESHOLD,
    );
    expect(result.texto).toBeDefined();
    expect(hasCitaTipada(result.texto!)).toBe(true);
    expect(result.cita).toMatch(/\[Fuente:.+\|\s*tipo:.+\]/i);
    expect(result.fragmentoIds.length).toBeGreaterThan(0);
    expect(result.registroRecuperacionId).toBeDefined();

    const reg = registros.findById(result.registroRecuperacionId!);
    expect(reg).toBeDefined();
    expect(reg!.handoffPorBajaConfianza).toBe(false);
    expect(reg!.fragmentosFinales.length).toBeGreaterThan(0);
    expect(reg!.umbral).toBe(DEFAULT_RERANK_THRESHOLD);
  });

  it("rerank bajo (max 0.70) → handoff rerank_bajo + safe K09 (D6 / C5)", async () => {
    applyScores(rerank, {
      "frag-k01-horarios": 0.7,
      "frag-k02-horario-visitas": 0.65,
      "frag-k01-ubicacion": 0.55,
    });

    const result = await pipeline.answer("¿Horario de visitas?", {
      sedeId: FIXTURE_SEDE_JARDIN_1,
    });

    expect(result.ok).toBe(false);
    expect(result.motivoHandoff).toBe("rerank_bajo");
    expect(result.texto).toBe(SAFE_COPY_K09);
    expect(result.fragmentoIds).toEqual([]);
    expect(Math.max(...result.scores, 0)).toBeLessThan(DEFAULT_RERANK_THRESHOLD);

    const reg = registros.findById(result.registroRecuperacionId!);
    expect(reg!.handoffPorUmbral).toBe(true);
    expect(reg!.motivoHandoff).toBe("rerank_bajo");
  });

  it("sin cita tipada → handoff sin_cita_rag (D6)", async () => {
    applyScores(rerank, { "frag-k01-horarios": 0.92 });
    llm.setFixture(
      "tipo de venue",
      "Tres Cielos es un jardín para eventos sociales.",
    );

    const result = await pipeline.answer("¿Qué tipo de venue es Tres Cielos?", {
      sedeId: null,
    });

    expect(result.ok).toBe(false);
    expect(result.motivoHandoff).toBe("sin_cita_rag");
    expect(result.texto).toBe(SAFE_COPY_K09);

    const reg = registros.findById(result.registroRecuperacionId!);
    expect(reg!.flags.sinCita).toBe(true);
  });

  it("Cohere down → handoff proveedor_ia; NUNCA bypass hybrid→LLM (D2)", async () => {
    rerank.simulateFailure(true);
    llm.setFixture(
      "Horarios comerciales",
      anchoredReply("K01-faq-general.pdf", "faq", "Horarios OK"),
    );
    const completeSpy = jest.spyOn(llm, "complete");

    const result = await pipeline.answer("¿Horarios comerciales?", {
      sedeId: null,
    });

    expect(result.ok).toBe(false);
    expect(result.motivoHandoff).toBe("proveedor_ia");
    expect(completeSpy).not.toHaveBeenCalled();
    expect(result.texto).toBe(SAFE_COPY_K09);

    const reg = registros.findById(result.registroRecuperacionId!);
    expect(reg!.flags.proveedorFallido).toBe(true);
  });

  it("intención monetaria llegada por error → no montos; redirigir tools", async () => {
    applyScores(rerank, { "frag-tarifa-ocr": 0.95 });
    llm.setFixture(
      "cuesta",
      anchoredReply(
        "tarjeta-precios.jpg",
        "foto",
        "El paquete cuesta $85,000 MXN",
      ),
    );

    const result = await pipeline.answer("¿Cuánto cuesta el paquete esencial?", {
      intencionMonetaria: true,
    });

    expect(result.ok).toBe(false);
    expect(result.redirigirTools).toBe(true);
    expect(result.motivoHandoff).toBe("intencion_monetaria");
    expect(result.texto).not.toMatch(/\$\s?\d/);
  });

  it("C5 invariante: ok=true implica max score ≥ umbral", async () => {
    applyScores(rerank, { "frag-k01-horarios": 0.86 });
    llm.setFixture(
      "Horarios comerciales",
      anchoredReply(
        "K01-faq-general.pdf",
        "faq",
        "Horarios comerciales martes a sábado 11:00 a 18:00.",
      ),
    );

    const result = await pipeline.answer("¿Horarios comerciales Tres Cielos?");
    expect(result.ok).toBe(true);
    expect(Math.min(...result.scores)).toBeGreaterThanOrEqual(
      DEFAULT_RERANK_THRESHOLD,
    );
  });
});
