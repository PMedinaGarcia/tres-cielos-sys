import type {
  LlmCompleteRequest,
  LlmCompleteResult,
  LlmCompleteWithToolsRequest,
  LlmCompleteWithToolsResult,
  LlmPort,
} from "../llm.port";
import { ProviderUnavailableError } from "../errors";

export type FakeLlmMode =
  | "hash"
  | "anchored"
  | "no_citation"
  | "with_amounts"
  | "fail";

/**
 * Alias usado por suites RAG (Fase D).
 * `mode` controla fixtures golden de cita / montos.
 */
export class FakeLlmAdapter implements LlmPort {
  mode: FakeLlmMode = "hash";
  anchoredCitation = "[Fuente: K01-faq-general.pdf | tipo: faq]";

  async complete(request: LlmCompleteRequest): Promise<LlmCompleteResult> {
    if (this.mode === "fail") {
      throw new ProviderUnavailableError("Fake LLM failure", "fake-llm");
    }
    const content = this.resolveContent(request);
    return {
      content,
      model: request.model ?? "fake-llm",
      usage: {
        promptTokens: 10,
        completionTokens: content.length,
        totalTokens: 10 + content.length,
      },
    };
  }

  async completeWithTools(
    request: LlmCompleteWithToolsRequest,
  ): Promise<LlmCompleteWithToolsResult> {
    const base = await this.complete(request);
    return { ...base, toolCalls: [] };
  }

  private resolveContent(request: LlmCompleteRequest): string {
    switch (this.mode) {
      case "anchored":
        return `Horario de visitas: lunes a domingo 10:00–18:00. ${this.anchoredCitation}`;
      case "no_citation":
        return "Horario de visitas: lunes a domingo 10:00–18:00.";
      case "with_amounts":
        return `El cartel menciona paquetes desde $45,000 MXN. ${this.anchoredCitation}`;
      case "hash":
      default: {
        const blob = request.messages.map((m) => m.content).join("|");
        return `fake:${blob.slice(0, 48)}`;
      }
    }
  }
}
