import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import type {
  LlmCompleteRequest,
  LlmCompleteResult,
  LlmCompleteWithToolsRequest,
  LlmCompleteWithToolsResult,
  LlmPort,
  LlmToolCall,
} from "../../ports/llm.port";
import { planCatalogToolsFromText } from "./catalog-tool-plan";

/**
 * LLM catalog-aware para CI del orquestador.
 * Implementa el LlmPort de ports/ con heurística de tools (C2 fake).
 * AiProviders FakeLlmPort queda disponible; este prioriza planes de catálogo.
 */
@Injectable()
export class CatalogAwareLlmPort implements LlmPort {
  async complete(request: LlmCompleteRequest): Promise<LlmCompleteResult> {
    const last = [...request.messages].reverse().find((m) => m.role === "user");
    const content = last?.content ?? "";
    return {
      content,
      model: request.model ?? "catalog-aware-fake",
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
    const lastUser = [...request.messages]
      .reverse()
      .find((m) => m.role === "user");
    const text = lastUser?.content ?? "";
    const available = new Set(request.tools.map((t) => t.name));
    const planned = planCatalogToolsFromText(text, available);
    const toolCalls: LlmToolCall[] = planned.map((p) => call(p.name, p.args));

    return {
      content: toolCalls.length > 0 ? "" : "sin_tool",
      toolCalls,
      model: request.model ?? "catalog-aware-fake",
      usage: {
        promptTokens: 20,
        completionTokens: 8,
        totalTokens: 28,
      },
    };
  }
}

function call(name: string, args: Record<string, unknown>): LlmToolCall {
  return {
    id: `call_${randomUUID().slice(0, 8)}`,
    name,
    argumentsJson: JSON.stringify(args),
  };
}
