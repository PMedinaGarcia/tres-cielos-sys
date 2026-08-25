export const LLM_PORT = "LLM_PORT";

export interface LlmMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  name?: string;
}

export interface LlmToolDefinition {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

export interface LlmToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface LlmCompletion {
  content: string | null;
  toolCalls?: LlmToolCall[];
  usage?: { promptTokens: number; completionTokens: number };
}

export interface LlmPort {
  complete(input: {
    messages: LlmMessage[];
    model?: string;
  }): Promise<LlmCompletion>;

  completeWithTools(input: {
    messages: LlmMessage[];
    tools: LlmToolDefinition[];
    model?: string;
  }): Promise<LlmCompletion>;
}
