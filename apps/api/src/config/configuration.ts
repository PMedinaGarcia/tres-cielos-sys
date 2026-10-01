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
      fetchChannelMedia:
        env.FETCH_CHANNEL_MEDIA === "1" ||
        (env.FETCH_CHANNEL_MEDIA !== "0" &&
          (env.STORAGE_PROVIDER === "s3" || env.STORAGE_PROVIDER === "r2")),
    },
    rag: {
      store: (env.RAG_STORE ??
        (env.AI_PROVIDERS_MODE === "live" ? "prisma" : "memory")) as
        | "memory"
        | "prisma",
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
    auth: {
      jwtSecret: env.JWT_SECRET ?? "dev-only-change-me-not-for-production",
      jwtExpiresIn: env.JWT_EXPIRES_IN ?? "15m",
      jwtRefreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN ?? "7d",
      cookieSecure:
        env.AUTH_COOKIE_SECURE === "true" || env.APP_ENV === "prod",
      cookieDomain: env.AUTH_COOKIE_DOMAIN || undefined,
    },
    publicApiUrl: env.PUBLIC_API_URL || undefined,
    queue: {
      driver: (env.QUEUE_DRIVER ?? "inline") as "inline" | "bullmq",
    },
    conversation: {
      flow: (env.CONVERSATION_FLOW ?? "v2") as "v1" | "v2" | "v3" | "v4",
      canaryPct: Number(env.CONVERSATION_FLOW_CANARY_PCT ?? 0),
    },
  };
};

export type AppConfig = ReturnType<typeof import("./configuration").default>;
