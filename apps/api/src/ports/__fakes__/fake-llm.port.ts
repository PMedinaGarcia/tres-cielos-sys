import type {
  LlmCompleteRequest,
  LlmCompleteResult,
  LlmCompleteWithToolsRequest,
  LlmCompleteWithToolsResult,
  LlmPort,
  LlmToolCall,
} from "../llm.port";
import { ProviderUnavailableError } from "../errors";
import { stableHash } from "./hash";

const DEFAULT_MODEL = "fake-llm";

/**
 * Fake determinista: respuesta por hash de mensajes; tool plan fijo opcional.
 * No realiza llamadas de red.
 */
export class FakeLlmPort implements LlmPort {
  private readonly fixtures = new Map<string, string>();
  private readonly toolPlans = new Map<string, LlmToolCall[]>();
  private failNext = false;

  /** Registra respuesta golden por clave (substring del prompt o hash). */
  setFixture(key: string, content: string): void {
    this.fixtures.set(key, content);
  }

  /** Tool plan fijo para completeWithTools cuando el prompt contiene `key`. */
  setToolPlan(key: string, toolCalls: LlmToolCall[]): void {
    this.toolPlans.set(key, toolCalls);
  }

  /** Simula fallo tipificado (proveedor_ia). */
  simulateFailure(enabled = true): void {
    this.failNext = enabled;
  }

  async complete(request: LlmCompleteRequest): Promise<LlmCompleteResult> {
    this.throwIfSimulated();
    const blob = serializeMessages(request.messages);
    const content = this.resolveFixture(blob) ?? `fake-complete:${stableHash(blob).slice(0, 12)}`;
    return {
      content,
      model: request.model ?? DEFAULT_MODEL,
      usage: { promptTokens: blob.length, completionTokens: content.length, totalTokens: blob.length + content.length },
    };
  }

  async completeWithTools(
    request: LlmCompleteWithToolsRequest,
  ): Promise<LlmCompleteWithToolsResult> {
    this.throwIfSimulated();
    const blob = serializeMessages(request.messages);
    const toolCalls = this.resolveToolPlan(blob) ?? defaultToolPlan(request);
    const content =
      toolCalls.length > 0
        ? ""
        : (this.resolveFixture(blob) ?? `fake-tools:${stableHash(blob).slice(0, 12)}`);
    return {
      content,
      toolCalls,
      model: request.model ?? DEFAULT_MODEL,
      usage: {
        promptTokens: blob.length,
        completionTokens: content.length,
        totalTokens: blob.length + content.length,
      },
    };
  }

  private throwIfSimulated(): void {
    if (this.failNext) {
      this.failNext = false;
      throw new ProviderUnavailableError("Fake LLM simulated failure", "fake-llm");
    }
  }

  private resolveFixture(blob: string): string | undefined {
    for (const [key, value] of this.fixtures) {
      if (blob.includes(key) || stableHash(blob).startsWith(key)) {
        return value;
      }
    }
    return undefined;
  }

  private resolveToolPlan(blob: string): LlmToolCall[] | undefined {
    for (const [key, plan] of this.toolPlans) {
      if (blob.includes(key)) {
        return plan;
      }
    }
    return undefined;
  }
}

function serializeMessages(messages: LlmCompleteRequest["messages"]): string {
  return messages.map((m) => `${m.role}:${m.content}`).join("\n");
}

function defaultToolPlan(request: LlmCompleteWithToolsRequest): LlmToolCall[] {
  if (request.toolChoice === "none" || request.tools.length === 0) {
    return [];
  }
  const name =
    typeof request.toolChoice === "object"
      ? request.toolChoice.name
      : request.tools[0]!.name;
  return [
    {
      id: `fake_call_${stableHash(name).slice(0, 8)}`,
      name,
      argumentsJson: "{}",
    },
  ];
}
