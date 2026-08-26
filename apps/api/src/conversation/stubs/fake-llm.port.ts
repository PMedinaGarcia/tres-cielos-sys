import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import type {
  LlmCompletion,
  LlmMessage,
  LlmPort,
  LlmToolDefinition,
} from "./llm.port";
import { planCatalogToolsFromText } from "./catalog-tool-plan";

/**
 * Fake determinista para CI — planifica tools por heurística lexical.
 * No llama a OpenAI.
 */
@Injectable()
export class FakeLlmPort implements LlmPort {
  async complete(input: {
    messages: LlmMessage[];
  }): Promise<LlmCompletion> {
    const last = [...input.messages].reverse().find((m) => m.role === "user");
    return {
      content: last?.content ?? null,
      usage: { promptTokens: 10, completionTokens: 10 },
    };
  }

  async completeWithTools(input: {
    messages: LlmMessage[];
    tools: LlmToolDefinition[];
  }): Promise<LlmCompletion> {
    const lastUser = [...input.messages]
      .reverse()
      .find((m) => m.role === "user");
    const text = lastUser?.content ?? "";
    const available = new Set(input.tools.map((t) => t.function.name));
    const planned = planCatalogToolsFromText(text, available);

    return {
      content: planned.length > 0 ? null : null,
      toolCalls: planned.map((p) => ({
        id: `call_${randomUUID().slice(0, 8)}`,
        type: "function" as const,
        function: { name: p.name, arguments: JSON.stringify(p.args) },
      })),
      usage: { promptTokens: 20, completionTokens: 8 },
    };
  }
}
