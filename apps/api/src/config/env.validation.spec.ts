import { validateEnv } from "./env.validation";

describe("validateEnv (A4)", () => {
  it("arranca en modo fake sin keys OpenAI/Cohere/S3", () => {
    const env = validateEnv({
      AI_PROVIDERS_MODE: "fake",
      RERANK_THRESHOLD: "0.85",
    });
    expect(env.AI_PROVIDERS_MODE).toBe("fake");
    expect(env.RERANK_THRESHOLD).toBe(0.85);
    expect(env.AI_REQUEST_TIMEOUT_MS).toBe(45_000);
    expect(env.AI_MAX_RETRIES).toBe(2);
    expect(env.OPENAI_MODEL_ORCHESTRATOR).toBe("gpt-4.1-mini");
  });

  it("exige keys en modo live", () => {
    expect(() =>
      validateEnv({
        AI_PROVIDERS_MODE: "live",
      }),
    ).toThrow(/OPENAI_API_KEY/);
  });

  it("acepta live con solo OpenAI (Cohere opcional)", () => {
    const env = validateEnv({
      AI_PROVIDERS_MODE: "live",
      OPENAI_API_KEY: "sk-test",
      STORAGE_PROVIDER: "memory",
    });
    expect(env.OPENAI_API_KEY).toBe("sk-test");
    expect(env.COHERE_API_KEY).toBeUndefined();
  });

  it("acepta live con OpenAI + Cohere", () => {
    const env = validateEnv({
      AI_PROVIDERS_MODE: "live",
      OPENAI_API_KEY: "sk-test",
      COHERE_API_KEY: "cohere-test",
      STORAGE_PROVIDER: "memory",
    });
    expect(env.COHERE_API_KEY).toBe("cohere-test");
  });
});
