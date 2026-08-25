import { IdempotencyService } from "../idempotency.service";

describe("Idempotencia externalMessageId", () => {
  let svc: IdempotencyService;

  beforeEach(() => {
    svc = new IdempotencyService();
  });

  it("procesa la primera vez y dedupea la segunda", () => {
    expect(svc.tryClaim("whatsapp", "SM1")).toBe(true);
    expect(svc.tryClaim("whatsapp", "SM1")).toBe(false);
    expect(svc.has("whatsapp", "SM1")).toBe(true);
  });

  it("permite mismo id en otro canal", () => {
    expect(svc.tryClaim("whatsapp", "mid-1")).toBe(true);
    expect(svc.tryClaim("facebook", "mid-1")).toBe(true);
  });

  it("rechaza id vacío", () => {
    expect(svc.tryClaim("whatsapp", "")).toBe(false);
  });
});
