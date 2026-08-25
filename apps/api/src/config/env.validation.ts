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

    /** `fake` = fakes CI/smoke; `live` = adapters OpenAI/Cohere/S3 reales. */
    AI_PROVIDERS_MODE: z.enum(["fake", "live"]).default("fake"),

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
  })
  .superRefine((data, ctx) => {
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
    if (data.STORAGE_PROVIDER !== "memory") {
      if (!data.S3_BUCKET?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["S3_BUCKET"],
          message: "S3_BUCKET es obligatorio cuando STORAGE_PROVIDER ≠ memory",
        });
      }
      if (!data.S3_ACCESS_KEY_ID?.trim() || !data.S3_SECRET_ACCESS_KEY?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["S3_ACCESS_KEY_ID"],
          message:
            "S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY obligatorias cuando STORAGE_PROVIDER ≠ memory",
        });
      }
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
