import { z } from "zod";

/**
 * Validación de env al boot (Zod) — alineado a docs/backend/07 §4.
 * Modo `fake` / smoke: arranca sin keys OpenAI/Cohere/S3.
 * Modo `live`: exige claves de proveedores activos.
 */
export const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_ENV: z.enum(["dev", "staging", "prod", "test"]).default("dev"),
    PORT: z.coerce.number().int().positive().default(3011),
    DATABASE_URL: z.string().min(1).optional(),
    REDIS_URL: z.string().optional(),
    CORS_ORIGINS: z.string().optional(),
    QUEUE_DRIVER: z.enum(["inline", "bullmq"]).default("inline"),

    JWT_SECRET: z
      .string()
      .min(32)
      .default("dev-only-change-me-not-for-production"),
    JWT_EXPIRES_IN: z.string().default("15m"),
    JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
    AUTH_COOKIE_SECURE: z.enum(["true", "false"]).optional(),
    AUTH_COOKIE_DOMAIN: z.string().optional(),
    AUTH_BOOTSTRAP_ADMIN_EMAIL: z.string().email().optional(),
    AUTH_BOOTSTRAP_ADMIN_PASSWORD: z.string().optional(),

    /** `fake` = fakes CI/smoke; `live` = adapters OpenAI/Cohere/S3 reales. */
    AI_PROVIDERS_MODE: z.enum(["fake", "live"]).default("fake"),

    /** Guion v1 secuencial, v2 (máx. 3 mensajes + piso) o v3 (conversión visita). */
    CONVERSATION_FLOW: z.enum(["v1", "v2", "v3", "v4"]).default("v2"),
    /** Con CONVERSATION_FLOW=v2, % de hilos nuevos que entran a v3 (hash de sede/hilo). */
    CONVERSATION_FLOW_CANARY_PCT: z.coerce.number().int().min(0).max(100).default(0),

    OPENAI_API_KEY: z.string().optional(),
    OPENAI_BASE_URL: z.string().url().optional().or(z.literal("")),
    OPENAI_ORG_ID: z.string().optional(),
    OPENAI_PROJECT_ID: z.string().optional(),
    OPENAI_MODEL_ORCHESTRATOR: z.string().default("gpt-4.1-mini"),
    OPENAI_MODEL_GENERATOR: z.string().default("gpt-4.1-mini"),
    OPENAI_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
    OPENAI_EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(1536),
    OPENAI_MODEL_VISION: z.string().default("gpt-4.1-mini"),
    OPENAI_WHISPER_MODEL: z.string().default("whisper-1"),

    COHERE_API_KEY: z.string().optional(),
    COHERE_RERANK_MODEL: z.string().default("rerank-v3.5"),
    RERANK_THRESHOLD: z.coerce.number().min(0).max(1).default(0.85),
    RERANK_TOP_N: z.coerce.number().int().positive().default(15),
    RERANK_TOP_K_LLM: z.coerce.number().int().positive().default(4),

    AI_MAX_TOKENS_ORCHESTRATOR: z.coerce.number().int().positive().default(1024),
    AI_MAX_TOKENS_GENERATOR: z.coerce.number().int().positive().default(800),
    AI_MAX_INPUT_CHARS_RAG: z.coerce.number().int().positive().default(12_000),
    AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(45_000),
    AI_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),

    CUPO_MENSUAL_MENSAJES: z.coerce.number().int().positive().default(1000),
    CUPO_AI_TOKENS_SOFT_LIMIT: z.coerce.number().int().positive().optional(),
    CUPO_AI_TOKENS_HARD_LIMIT: z.coerce.number().int().positive().optional(),

    STORAGE_PROVIDER: z.enum(["s3", "r2", "gcs", "memory"]).default("memory"),
    S3_ENDPOINT: z.string().optional(),
    S3_REGION: z.string().default("us-east-1"),
    S3_BUCKET: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    STORAGE_PUBLIC_BASE_URL: z.string().optional(),
    PUBLIC_API_URL: z.string().url().optional().or(z.literal("")),
    /** memory = índice in-process; prisma = pgvector + FTS. Default: memory si fake, prisma si live. */
    RAG_STORE: z.enum(["memory", "prisma"]).optional(),
    FETCH_CHANNEL_MEDIA: z.enum(["0", "1"]).optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.APP_ENV === "prod" &&
      data.JWT_SECRET === "dev-only-change-me-not-for-production"
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["JWT_SECRET"],
        message: "JWT_SECRET no puede ser el valor de desarrollo en APP_ENV=prod",
      });
    }
    if (
      (data.APP_ENV === "staging" || data.APP_ENV === "prod") &&
      data.STORAGE_PROVIDER !== "s3" &&
      data.STORAGE_PROVIDER !== "r2"
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["STORAGE_PROVIDER"],
        message:
          "STORAGE_PROVIDER debe ser s3 o r2 en APP_ENV=staging|prod",
      });
    }
    if (data.STORAGE_PROVIDER !== "memory" && !data.S3_BUCKET?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["S3_BUCKET"],
        message: "S3_BUCKET es obligatorio cuando STORAGE_PROVIDER ≠ memory",
      });
    }
    if (data.AI_PROVIDERS_MODE !== "live") {
      return;
    }
    if (!data.OPENAI_API_KEY?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["OPENAI_API_KEY"],
        message: "OPENAI_API_KEY es obligatoria con AI_PROVIDERS_MODE=live",
      });
    }
  });

export type AppEnv = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): AppEnv {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Validación de entorno fallida: ${details}`);
  }
  return parsed.data;
}
