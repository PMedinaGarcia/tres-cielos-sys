import { QuotaService } from "../quota.service";

describe("QuotaService soft/hard", () => {
  let quota: QuotaService;

  beforeEach(() => {
    quota = new QuotaService();
    process.env.QUOTA_MSG_SOFT = "5";
    process.env.QUOTA_MSG_HARD = "8";
    process.env.QUOTA_AI_TOKENS_SOFT = "1000";
    process.env.QUOTA_AI_TOKENS_HARD = "1500";
  });

  it("soft warning sin hard", () => {
    quota.setUsage("s1", 5, 0);
    const s = quota.snapshot("s1");
    expect(s.softWarning).toBe(true);
    expect(s.hardBlocked).toBe(false);
  });

  it("hard mensajería bloquea", () => {
    quota.setUsage("s1", 8, 0);
    expect(quota.consumeMessaging("s1").hardBlocked).toBe(true);
  });

  it("hard IA tokens bloquea", () => {
    quota.setUsage("s1", 0, 1500);
    expect(quota.checkAi("s1").hardBlocked).toBe(true);
  });
});
