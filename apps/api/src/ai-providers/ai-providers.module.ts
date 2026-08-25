import { Global, Logger, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import {
  EMBEDDINGS_PORT,
  LLM_PORT,
  OBJECT_STORAGE_PORT,
  RERANK_PORT,
  TRANSCRIPTION_PORT,
  VISION_PORT,
} from "../ports/tokens";
import {
  FakeEmbeddingsPort,
  FakeLlmPort,
  FakeObjectStoragePort,
  FakeRerankPort,
  FakeTranscriptionPort,
  FakeVisionPort,
} from "../ports/__fakes__";
import { OpenAiLlmAdapter } from "./openai.llm.adapter";
import { OpenAiEmbeddingsAdapter } from "./openai.embeddings.adapter";
import { OpenAiVisionAdapter } from "./openai.vision.adapter";
import { OpenAiTranscriptionAdapter } from "./openai.transcription.adapter";
import { CohereRerankAdapter } from "./cohere.rerank.adapter";
import { S3StorageAdapter } from "./s3.storage.adapter";

const PORT_EXPORTS = [
  LLM_PORT,
  EMBEDDINGS_PORT,
  RERANK_PORT,
  VISION_PORT,
  TRANSCRIPTION_PORT,
  OBJECT_STORAGE_PORT,
];

/**
 * Registra adapters OpenAI / Cohere / S3 detrás de `AI_PROVIDERS_MODE`.
 * `fake` (default smoke/CI): fakes deterministas, boot sin keys.
 * `live`: adapters reales (exige keys vía validateEnv).
 *
 * Otros módulos importan `AiProvidersModule` e inyectan tokens:
 * `@Inject(LLM_PORT) private readonly llm: LlmPort`
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: OBJECT_STORAGE_PORT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const mode = config.get<string>("ai.providersMode") ?? "fake";
        const storageProvider = config.get<string>("storage.provider") ?? "memory";
        if (mode === "fake" || storageProvider === "memory") {
          return new FakeObjectStoragePort(
            config.get<string>("storage.bucket") ?? "fake-bucket",
          );
        }
        return new S3StorageAdapter(config);
      },
    },
    {
      provide: LLM_PORT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => createLlm(config),
    },
    {
      provide: EMBEDDINGS_PORT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => createEmbeddings(config),
    },
    {
      provide: RERANK_PORT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => createRerank(config),
    },
    {
      provide: VISION_PORT,
      inject: [ConfigService, OBJECT_STORAGE_PORT],
      useFactory: (config: ConfigService, storage: unknown) =>
        createVision(config, storage),
    },
    {
      provide: TRANSCRIPTION_PORT,
      inject: [ConfigService, OBJECT_STORAGE_PORT],
      useFactory: (config: ConfigService, storage: unknown) =>
        createTranscription(config, storage),
    },
  ],
  exports: PORT_EXPORTS,
})
export class AiProvidersModule {
  private readonly logger = new Logger(AiProvidersModule.name);

  constructor(config: ConfigService) {
    const mode = config.get<string>("ai.providersMode") ?? "fake";
    this.logger.log(
      `AiProvidersModule boot mode=${mode} rerankThreshold=${config.get("ai.rerank.threshold") ?? 0.85}`,
    );
  }
}

function isFakeMode(config: ConfigService): boolean {
  return (config.get<string>("ai.providersMode") ?? "fake") === "fake";
}

function createLlm(config: ConfigService) {
  if (isFakeMode(config)) return new FakeLlmPort();
  return new OpenAiLlmAdapter(config);
}

function createEmbeddings(config: ConfigService) {
  if (isFakeMode(config)) {
    return new FakeEmbeddingsPort(
      config.get<number>("ai.openai.embeddingDimensions") ?? 1536,
    );
  }
  return new OpenAiEmbeddingsAdapter(config);
}

function createRerank(config: ConfigService) {
  const threshold = config.get<number>("ai.rerank.threshold") ?? 0.85;
  const cohereKey = config.get<string>("ai.cohere.apiKey")?.trim();
  if (isFakeMode(config) || !cohereKey) {
    return new FakeRerankPort(threshold);
  }
  return new CohereRerankAdapter(config);
}

function createVision(config: ConfigService, storage: unknown) {
  if (isFakeMode(config)) return new FakeVisionPort();
  return new OpenAiVisionAdapter(config, storage as never);
}

function createTranscription(config: ConfigService, storage: unknown) {
  if (isFakeMode(config)) return new FakeTranscriptionPort();
  return new OpenAiTranscriptionAdapter(config, storage as never);
}
