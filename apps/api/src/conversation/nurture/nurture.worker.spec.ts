import { NurtureWorkerService } from "./nurture.worker";

describe("NurtureWorkerService", () => {
  it("programa 2 toques y cancela", () => {
    const w = new NurtureWorkerService();
    const jobs = w.schedule({
      conversacionId: "c1",
      nombre: "Ana",
      consentimiento: true,
      now: new Date("2026-09-01T00:00:00.000Z"),
    });
    expect(jobs).toHaveLength(2);
    expect(jobs[0]!.toque).toBe(1);
    expect(w.copyFor(jobs[0]!)).toMatch(/Ana/);
    expect(w.copyFor(jobs[0]!)).toMatch(/250,000|fecha/);
    w.cancel("c1");
    expect(w.processDue(new Date("2026-09-10T00:00:00.000Z"))).toHaveLength(0);
  });

  it("sin consentimiento no agenda", () => {
    const w = new NurtureWorkerService();
    expect(
      w.schedule({ conversacionId: "c1", consentimiento: false }),
    ).toHaveLength(0);
  });

  it("processDue entrega toque 1 a las 24h", () => {
    const w = new NurtureWorkerService();
    const now = new Date("2026-09-01T00:00:00.000Z");
    w.schedule({ conversacionId: "c1", nombre: "Ana", consentimiento: true, now });
    expect(w.processDue(new Date("2026-09-01T12:00:00.000Z"))).toHaveLength(0);
    const due = w.processDue(new Date("2026-09-02T01:00:00.000Z"));
    expect(due).toHaveLength(1);
    expect(due[0]!.job.toque).toBe(1);
  });
});
