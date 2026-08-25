export interface LlmMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  toolCallId?: string;
}

export interface LlmToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface LlmToolCall {
  id: string;
  name: string;
  argumentsJson: string;
}

export interface LlmCompleteRequest {
  model?: string;
  messages: LlmMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface LlmCompleteResult {
  content: string;
  model: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
}

export interface LlmCompleteWithToolsRequest extends LlmCompleteRequest {
  tools: LlmToolDefinition[];
  toolChoice?: "auto" | "none" | { name: string };
}

export interface LlmCompleteWithToolsResult extends LlmCompleteResult {
  toolCalls: LlmToolCall[];
}

/**
 * Port LLM (orquestador + generador RAG).
 * Implementación prod: OpenAI SDK oficial. CI: FakeLlmPort.
 */
export interface LlmPort {
  complete(request: LlmCompleteRequest): Promise<LlmCompleteResult>;
  completeWithTools(
    request: LlmCompleteWithToolsRequest,
  ): Promise<LlmCompleteWithToolsResult>;
}
