import { Test } from "@nestjs/testing";
import {
  EMBEDDINGS_PORT,
  LLM_PORT,
  OBJECT_STORAGE_PORT,
  RERANK_PORT,
  TRANSCRIPTION_PORT,
  VISION_PORT,
} from "./tokens";
import type { EmbeddingsPort } from "./embeddings.port";
import type { LlmPort } from "./llm.port";
import type { ObjectStoragePort } from "./object-storage.port";
import type { RerankPort } from "./rerank.port";
import type { TranscriptionPort } from "./transcription.port";
import type { VisionPort } from "./vision.port";
import { ProviderUnavailableError, isProviderError } from "./errors";
import {
  FAKE_EMBEDDING_DIMENSIONS,
  FakeEmbeddingsPort,
  FakeLlmPort,
  FakeObjectStoragePort,
  FakeRerankPort,
  FakeTranscriptionPort,
  FakeVisionPort,
  hashToEmbedding,
} from "./__fakes__";

describe("ports fakes (DI)", () => {
  let llm: FakeLlmPort;
  let embeddings: FakeEmbeddingsPort;
  let rerank: FakeRerankPort;
  let vision: FakeVisionPort;
  let transcription: FakeTranscriptionPort;
  let storage: FakeObjectStoragePort;

  beforeEach(async () => {
    llm = new FakeLlmPort();
    embeddings = new FakeEmbeddingsPort();
    rerank = new FakeRerankPort(0.85);
    vision = new FakeVisionPort();
    transcription = new FakeTranscriptionPort();
    storage = new FakeObjectStoragePort();

    const moduleRef = await Test.createTestingModule({
      providers: [
        { provide: LLM_PORT, useValue: llm },
        { provide: EMBEDDINGS_PORT, useValue: embeddings },
        { provide: RERANK_PORT, useValue: rerank },
        { provide: VISION_PORT, useValue: vision },
        { provide: TRANSCRIPTION_PORT, useValue: transcription },
        { provide: OBJECT_STORAGE_PORT, useValue: storage },
      ],
    }).compile();

    expect(moduleRef.get<LlmPort>(LLM_PORT)).toBe(llm);
    expect(moduleRef.get<EmbeddingsPort>(EMBEDDINGS_PORT)).toBe(embeddings);
    expect(moduleRef.get<RerankPort>(RERANK_PORT)).toBe(rerank);
    expect(moduleRef.get<VisionPort>(VISION_PORT)).toBe(vision);
    expect(moduleRef.get<TranscriptionPort>(TRANSCRIPTION_PORT)).toBe(transcription);
    expect(moduleRef.get<ObjectStoragePort>(OBJECT_STORAGE_PORT)).toBe(storage);
  });

  it("LlmPort: complete es determinista por prompt", async () => {
    llm.setFixture("hola", "respuesta-fixture");
    const a = await llm.complete({
      messages: [{ role: "user", content: "hola mundo" }],
    });
    const b = await llm.complete({
      messages: [{ role: "user", content: "hola mundo" }],
    });
    expect(a.content).toBe("respuesta-fixture");
    expect(b.content).toBe(a.content);
  });

  it("LlmPort: completeWithTools usa tool plan fijo", async () => {
    llm.setToolPlan("precio", [
      {
        id: "call_1",
        name: "obtener_precio_paquete",
        argumentsJson: '{"sku":"BODA-J1"}',
      },
    ]);
    const result = await llm.completeWithTools({
      messages: [{ role: "user", content: "¿cuál es el precio?" }],
      tools: [
        {
          name: "obtener_precio_paquete",
          description: "precio",
          parameters: { type: "object" },
        },
      ],
    });
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]!.name).toBe("obtener_precio_paquete");
  });

  it("LlmPort: fallo tipificado ProviderUnavailable", async () => {
    llm.simulateFailure(true);
    await expect(
      llm.complete({ messages: [{ role: "user", content: "x" }] }),
    ).rejects.toBeInstanceOf(ProviderUnavailableError);
  });

  it("EmbeddingsPort: vector determinista y dimensión 1536", async () => {
    const a = await embeddings.embedOne({ text: "faq horarios" });
    const b = await embeddings.embedOne({ text: "faq horarios" });
    expect(a.dimensions).toBe(FAKE_EMBEDDING_DIMENSIONS);
    expect(a.embedding).toEqual(b.embedding);
    expect(a.embedding).toEqual(hashToEmbedding("faq horarios"));
    const batch = await embeddings.embedBatch({ texts: ["a", "b"] });
    expect(batch.embeddings).toHaveLength(2);
  });

  it("RerankPort: respeta tabla de scores y umbral 0.85", async () => {
    rerank.setScore("frag-hi", 0.91);
    rerank.setScore("frag-lo", 0.7);
    const result = await rerank.rerank({
      query: "horarios",
      passages: [
        { id: "frag-lo", text: "bajo" },
        { id: "frag-hi", text: "alto" },
      ],
    });
    expect(result.threshold).toBe(0.85);
    expect(result.hits[0]!.id).toBe("frag-hi");
    expect(result.hits[0]!.score).toBe(0.91);
    expect(result.hits[0]!.score).toBeGreaterThanOrEqual(0.85);
  });

  it("VisionPort / TranscriptionPort: fixtures golden", async () => {
    const v = await vision.describeOrExtractText({
      imageRef: "x",
      fixtureName: "tarifa",
    });
    expect(v.detectedAmounts?.length).toBeGreaterThan(0);
    const t = await transcription.transcribeAudio({
      audioRef: "clip.mp4",
      fixtureName: "default",
    });
    expect(t.text).toContain("Tres Cielos");
  });

  it("ObjectStoragePort: put/get/signedUrl/exists/delete en memoria", async () => {
    await storage.put({
      key: "adjuntos/a.jpg",
      body: "bytes",
      contentType: "image/jpeg",
    });
    const got = await storage.get("adjuntos/a.jpg");
    expect(got.body.toString("utf8")).toBe("bytes");
    expect(await storage.exists("adjuntos/a.jpg")).toBe(true);
    expect(await storage.ping()).toBe(true);
    const url = await storage.signedUrl({ key: "adjuntos/a.jpg" });
    expect(url).toContain("memory://");
    await storage.delete("adjuntos/a.jpg");
    expect(await storage.exists("adjuntos/a.jpg")).toBe(false);
    try {
      await storage.get("adjuntos/a.jpg");
      fail("expected StorageError");
    } catch (e) {
      expect(isProviderError(e)).toBe(true);
      expect((e as { code: string }).code).toBe("STORAGE_ERROR");
    }
  });
});
