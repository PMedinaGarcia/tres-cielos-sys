import type { AppEnv } from "./env.validation";

/**
 * Config tipada inyectable vía ConfigService.
 * Claves anidadas bajo `ai`, `storage`, `cupo`.
 */
export default () => {
  const env = process.env;
  return {
    appEnv: (env.APP_ENV ?? "dev") as AppEnv["APP_ENV"],
    port: Number(env.PORT ?? 3011),
    ai: {
      providersMode: (env.AI_PROVIDERS_MODE ?? "fake") as "fake" | "live",
      openai: {
        apiKey: env.OPENAI_API_KEY,
        baseUrl: env.OPENAI_BASE_URL || undefined,
        orgId: env.OPENAI_ORG_ID,
        projectId: env.OPENAI_PROJECT_ID,
        modelOrchestrator: env.OPENAI_MODEL_ORCHESTRATOR ?? "gpt-4.1-mini",
        modelGenerator: env.OPENAI_MODEL_GENERATOR ?? "gpt-4.1-mini",
        embeddingModel: env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
        embeddingDimensions: Number(env.OPENAI_EMBEDDING_DIMENSIONS ?? 1536),
        modelVision: env.OPENAI_MODEL_VISION ?? "gpt-4.1-mini",
        whisperModel: env.OPENAI_WHISPER_MODEL ?? "whisper-1",
      },
      cohere: {
        apiKey: env.COHERE_API_KEY,
        rerankModel: env.COHERE_RERANK_MODEL ?? "rerank-v3.5",
      },
      rerank: {
        threshold: Number(env.RERANK_THRESHOLD ?? 0.85),
        topN: Number(env.RERANK_TOP_N ?? 15),
        topKLlm: Number(env.RERANK_TOP_K_LLM ?? 4),
      },
      caps: {
        maxTokensOrchestrator: Number(env.AI_MAX_TOKENS_ORCHESTRATOR ?? 1024),
        maxTokensGenerator: Number(env.AI_MAX_TOKENS_GENERATOR ?? 800),
        maxInputCharsRag: Number(env.AI_MAX_INPUT_CHARS_RAG ?? 12_000),
        requestTimeoutMs: Number(env.AI_REQUEST_TIMEOUT_MS ?? 45_000),
        maxRetries: Number(env.AI_MAX_RETRIES ?? 2),
      },
    },
    storage: {
      provider: (env.STORAGE_PROVIDER ?? "memory") as "s3" | "r2" | "gcs" | "memory",
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION ?? "us-east-1",
      bucket: env.S3_BUCKET ?? "tres-cielos-dev",
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      publicBaseUrl: env.STORAGE_PUBLIC_BASE_URL,
    },
    cupo: {
      mensualMensajes: Number(env.CUPO_MENSUAL_MENSAJES ?? 1000),
      aiTokensSoftLimit: env.CUPO_AI_TOKENS_SOFT_LIMIT
        ? Number(env.CUPO_AI_TOKENS_SOFT_LIMIT)
        : undefined,
      aiTokensHardLimit: env.CUPO_AI_TOKENS_HARD_LIMIT
        ? Number(env.CUPO_AI_TOKENS_HARD_LIMIT)
        : undefined,
    },
  };
};

export type AppConfig = ReturnType<typeof import("./configuration").default>;
