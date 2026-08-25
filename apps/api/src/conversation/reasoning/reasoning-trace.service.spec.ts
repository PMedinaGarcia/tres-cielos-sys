import { ReasoningTraceService } from "./reasoning-trace.service";

describe("ReasoningTraceService", () => {
  it("ordena steps y finaliza outcome dentro de runWithTurn", async () => {
    const svc = new ReasoningTraceService();
    const result = await svc.runWithTurn(
      { conversacionId: "c1", turnId: "m1" },
      async (trace) => {
        svc.append({
          level: "intent",
          value: "pregunta_documental",
        });
        svc.append({
          level: "routing",
          decision: { kind: "rag" },
          inputs: {
            capturaPendiente: false,
            adjuntoInvalido: false,
            hardQuota: false,
          },
        });
        svc.finish({
          ruta: "rag",
          estadoBot: "activo",
          motivoHandoff: null,
          eventoOperativoId: "ev1",
          registroConsultaCatalogoId: null,
          registroRecuperacionId: "rr1",
        });
        return trace.id;
      },
    );

    const stored = svc.get(result)!;
    expect(stored.turnId).toBe("m1");
    expect(stored.steps.map((s) => s.level)).toEqual([
      "intent",
      "routing",
      "outcome",
    ]);
    expect(stored.steps[0]?.seq).toBe(0);
    expect(stored.outcome?.ruta).toBe("rag");
    expect(stored.finishedAt).toBeTruthy();
  });

  it("append fuera de contexto no lanza", () => {
    const svc = new ReasoningTraceService();
    expect(() =>
      svc.append({ level: "handoff", motivo: "otro" }),
    ).not.toThrow();
  });
});
