import {
  bucket,
  defineRailway,
  group,
  postgres,
  preserve,
  project,
  redis,
  ref,
  service,
} from "railway/iac";

const API_START = "node /app/apps/api/dist/src/main.js";
const API_PREDEPLOY = "pnpm --filter @tres-cielos/api prisma:deploy";
const WEB_BUILD =
  "pnpm install && pnpm --filter @tres-cielos/shared build && pnpm --filter @tres-cielos/web build";
const WEB_START = "pnpm --filter @tres-cielos/web start";

const MONOREPO_WATCH = [
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "nixpacks.toml",
  ".npmrc",
  "packages/shared/**",
];

export default defineRailway(() => {
  const db = postgres("postgres");
  const cache = redis("redis");
  const media = bucket("media", { region: "iad" });

  const api = service("api", {
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "Dockerfile.api",
      watchPatterns: [...MONOREPO_WATCH, "apps/api/**", "Dockerfile.api"],
    },
    preDeploy: API_PREDEPLOY,
    start: API_START,
    healthcheck: "/health",
    healthcheckTimeout: 60,
    deploy: {
      restartPolicyType: "ON_FAILURE",
      restartPolicyMaxRetries: 3,
    },
    env: {
      NODE_ENV: "production",
      APP_ENV: "staging",
      PORT: "3011",
      LOG_LEVEL: "info",
      QUEUE_DRIVER: "inline",
      AI_PROVIDERS_MODE: "live",
      RAG_STORE: "prisma",
      STORAGE_PROVIDER: "s3",
      FETCH_CHANNEL_MEDIA: "1",
      AUTH_COOKIE_SECURE: "true",
      JWT_EXPIRES_IN: "15m",
      JWT_REFRESH_EXPIRES_IN: "7d",
      OPENAI_MODEL_ORCHESTRATOR: "gpt-4.1-mini",
      OPENAI_MODEL_GENERATOR: "gpt-4.1-mini",
      OPENAI_EMBEDDING_MODEL: "text-embedding-3-small",
      OPENAI_EMBEDDING_DIMENSIONS: "1536",
      OPENAI_MODEL_VISION: "gpt-4.1-mini",
      OPENAI_WHISPER_MODEL: "whisper-1",
      COHERE_RERANK_MODEL: "rerank-v3.5",
      RERANK_THRESHOLD: "0.85",
      RERANK_TOP_N: "15",
      RERANK_TOP_K_LLM: "4",
      AI_MAX_TOKENS_ORCHESTRATOR: "1024",
      AI_MAX_TOKENS_GENERATOR: "800",
      AI_MAX_INPUT_CHARS_RAG: "12000",
      AI_REQUEST_TIMEOUT_MS: "45000",
      AI_MAX_RETRIES: "2",
      CUPO_MENSUAL_MENSAJES: "1000",
      QUOTA_MSG_SOFT: "800",
      QUOTA_MSG_HARD: "1000",
      QUOTA_AI_TOKENS_SOFT: "200000",
      QUOTA_AI_TOKENS_HARD: "250000",
      S3_REGION: "us-east-1",
      DATABASE_URL: db.env.DATABASE_URL,
      REDIS_URL: cache.env.REDIS_URL,
      S3_BUCKET: ref(media, "BUCKET"),
      S3_ACCESS_KEY_ID: ref(media, "ACCESS_KEY_ID"),
      S3_SECRET_ACCESS_KEY: ref(media, "SECRET_ACCESS_KEY"),
      S3_ENDPOINT: ref(media, "ENDPOINT"),
      JWT_SECRET: preserve(),
      OPENAI_API_KEY: preserve(),
      AUTH_BOOTSTRAP_ADMIN_EMAIL: preserve(),
      AUTH_BOOTSTRAP_ADMIN_PASSWORD: preserve(),
      CORS_ORIGINS: preserve(),
      PUBLIC_API_URL: preserve(),
      TWILIO_WEBHOOK_URL: preserve(),
    },
  });

  const web = service("web", {
    build: {
      buildCommand: WEB_BUILD,
      watchPatterns: [...MONOREPO_WATCH, "apps/web/**"],
    },
    start: WEB_START,
    healthcheck: "/health",
    healthcheckTimeout: 60,
    deploy: {
      restartPolicyType: "ON_FAILURE",
      restartPolicyMaxRetries: 3,
    },
    env: {
      NODE_ENV: "production",
      NEXT_PUBLIC_APP_ENV: "staging",
      NEXT_PUBLIC_DEFAULT_LOCALE: "es-MX",
      NEXT_PUBLIC_API_URL: "/backend",
      API_INTERNAL_URL: "http://api.railway.internal:3011",
    },
  });

  const infra = group("Infra", [db, cache, media]);
  const apps = group("Apps", [api, web]);

  return project("tres-cielos-sys", {
    resources: [infra, apps],
  });
});
