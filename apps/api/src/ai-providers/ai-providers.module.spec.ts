import { Test } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { AiProvidersModule } from "./ai-providers.module";
import { configuration } from "../config";
import {
  EMBEDDINGS_PORT,
  LLM_PORT,
  OBJECT_STORAGE_PORT,
  RERANK_PORT,
} from "../ports/tokens";
import type { LlmPort } from "../ports/llm.port";
import type { EmbeddingsPort } from "../ports/embeddings.port";
import type { RerankPort } from "../ports/rerank.port";
import type { ObjectStoragePort } from "../ports/object-storage.port";
import { FakeLlmPort } from "../ports/__fakes__";

describe("AiProvidersModule (A2)", () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env = { ...prev };
  });

  it("boot en modo fake sin keys y exporta fakes", async () => {
    process.env.AI_PROVIDERS_MODE = "fake";
    process.env.STORAGE_PROVIDER = "memory";
    delete process.env.OPENAI_API_KEY;
    delete process.env.COHERE_API_KEY;

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [configuration],
          ignoreEnvFile: true,
        }),
        AiProvidersModule,
      ],
    }).compile();

    const llm = moduleRef.get<LlmPort>(LLM_PORT);
    expect(llm).toBeInstanceOf(FakeLlmPort);

    const emb = moduleRef.get<EmbeddingsPort>(EMBEDDINGS_PORT);
    const vec = await emb.embedOne({ text: "smoke" });
    expect(vec.dimensions).toBe(1536);

    const rerank = moduleRef.get<RerankPort>(RERANK_PORT);
    const rr = await rerank.rerank({
      query: "q",
      passages: [{ id: "1", text: "p" }],
    });
    expect(rr.threshold).toBe(0.85);

    const storage = moduleRef.get<ObjectStoragePort>(OBJECT_STORAGE_PORT);
    await storage.put({
      key: "k",
      body: "x",
      contentType: "text/plain",
    });
    expect((await storage.get("k")).body.toString()).toBe("x");

    await moduleRef.close();
  });
});
