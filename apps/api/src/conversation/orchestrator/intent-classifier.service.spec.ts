import { IntentClassifierService } from "./intent-classifier.service";

describe("IntentClassifierService", () => {
  it("en fake no llama LLM si el léxico ya resolvió", async () => {
    const llm = {
      complete: jest.fn(),
      completeWithTools: jest.fn(),
    };
    const clf = new IntentClassifierService(llm as never, {
      get: () => "fake",
    } as never);
    const intent = await clf.classify({
      texto: "¿Cuánto cuesta el paquete?",
      pasoGuion: "faq_libre",
    });
    expect(intent).toBe("datos_duros");
    expect(llm.complete).not.toHaveBeenCalled();
  });

  it("si ambiguo y live, usa LLM", async () => {
    const llm = {
      complete: jest.fn(async () => ({
        content: '{"intent":"datos_duros","confianza":0.95}',
        model: "test",
      })),
      completeWithTools: jest.fn(),
    };
    const clf = new IntentClassifierService(llm as never, {
      get: (k: string) => (k === "ai.providersMode" ? "live" : undefined),
    } as never);
    const intent = await clf.classify({
      texto: "blergh",
      pasoGuion: "faq_libre",
    });
    expect(intent).toBe("datos_duros");
    expect(llm.complete).toHaveBeenCalled();
  });
});
