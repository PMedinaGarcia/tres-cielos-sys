import { RegistroRecuperacionService } from "./registro-recuperacion.service";
import { buildKnowledgeFixtures } from "./fixtures/knowledge-fixtures";
import { RerankedCandidate } from "./types";

describe("RegistroRecuperacionService (D4)", () => {
  it("persiste query, candidatos, scores, fragmentos, cita y flags", () => {
    const svc = new RegistroRecuperacionService();
    const frag = buildKnowledgeFixtures().find(
      (f) => f.id === "frag-k01-horarios",
    )!;
    const ranked: RerankedCandidate[] = [
      {
        fragmento: frag,
        scoreHybrid: 0.72,
        scoreRerank: 0.91,
        origenRama: "ambos",
        scoreVector: 0.7,
        scoreFts: 0.72,
      },
    ];

    const reg = svc.create({
      queryOriginal: "¿Cuál es el horario de visitas del jardín?",
      queryRewrite: null,
      umbral: 0.85,
      conversacionId: "conv-1",
      mensajeId: "msg-1",
      ranked,
      finales: ranked,
      respuestaTexto: `Horarios martes a sábado.\n[Fuente: ${frag.nombreArchivoCita} | tipo: ${frag.tipoMaterial}]`,
      cita: `[Fuente: ${frag.nombreArchivoCita} | tipo: ${frag.tipoMaterial}]`,
      motivoHandoff: null,
    });

    expect(reg.id).toBeTruthy();
    expect(reg.queryOriginal).toContain("horario");
    expect(reg.umbral).toBe(0.85);
    expect(reg.candidatos).toHaveLength(1);
    expect(reg.candidatos[0]!.scoreRerank).toBe(0.91);
    expect(reg.candidatos[0]!.scoreHybrid).toBe(0.72);
    expect(reg.candidatos[0]!.origenRama).toBe("ambos");
    expect(reg.fragmentosFinales[0]!.nombreArchivoCita).toBe(
      frag.nombreArchivoCita,
    );
    expect(reg.fuentesCita).toContain(frag.nombreArchivoCita);
    expect(reg.cita).toMatch(/Fuente:/);
    expect(reg.tipoMaterial).toBe("faq");
    expect(reg.flags.algunNoRecuperablePrecio).toBe(false);
    expect(svc.findById(reg.id)).toEqual(reg);
  });

  it("marca handoffPorUmbral cuando motivo rerank_bajo", () => {
    const svc = new RegistroRecuperacionService();
    const reg = svc.create({
      queryOriginal: "x",
      umbral: 0.85,
      ranked: [],
      finales: [],
      motivoHandoff: "rerank_bajo",
      handoffPorBajaConfianza: true,
    });
    expect(reg.handoffPorUmbral).toBe(true);
    expect(reg.handoffPorBajaConfianza).toBe(true);
  });
});
