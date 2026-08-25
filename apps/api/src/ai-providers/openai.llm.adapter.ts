import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type {
  LlmCompleteRequest,
  LlmCompleteResult,
  LlmCompleteWithToolsRequest,
  LlmCompleteWithToolsResult,
  LlmMessage,
  LlmPort,
  LlmToolCall,
} from "../ports/llm.port";
import {
  ProviderRateLimitError,
  ProviderTimeoutError,
  ProviderUnavailableError,
} from "../ports/errors";

function toOpenAiMessages(messages: LlmMessage[]): ChatCompletionMessageParam[] {
  return messages.map((m) => {
    if (m.role === "tool") {
      return {
        role: "tool" as const,
        content: m.content,
        tool_call_id: m.toolCallId ?? "unknown",
      };
    }
    if (m.role === "system") {
      return { role: "system" as const, content: m.content };
    }
    if (m.role === "assistant") {
      return { role: "assistant" as const, content: m.content };
    }
    return {
      role: "user" as const,
      content: m.content,
      ...(m.name ? { name: m.name } : {}),
    };
  });
}

@Injectable()
export class OpenAiLlmAdapter implements LlmPort {
  private readonly client: OpenAI;
  private readonly defaultModel: string;
  private readonly timeoutMs: number;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>("ai.openai.apiKey");
    if (!apiKey) {
      throw new ProviderUnavailableError("OPENAI_API_KEY missing", "openai");
    }
    this.client = new OpenAI({
      apiKey,
      baseURL: this.config.get<string>("ai.openai.baseUrl"),
      organization: this.config.get<string>("ai.openai.orgId"),
      project: this.config.get<string>("ai.openai.projectId"),
      timeout: this.config.get<number>("ai.caps.requestTimeoutMs") ?? 45_000,
      maxRetries: this.config.get<number>("ai.caps.maxRetries") ?? 2,
    });
    this.defaultModel =
      this.config.get<string>("ai.openai.modelOrchestrator") ?? "gpt-4.1-mini";
    this.timeoutMs = this.config.get<number>("ai.caps.requestTimeoutMs") ?? 45_000;
  }

  async complete(request: LlmCompleteRequest): Promise<LlmCompleteResult> {
    try {
      const response = await this.client.chat.completions.create({
        model: request.model ?? this.defaultModel,
        messages: toOpenAiMessages(request.messages),
        max_tokens:
          request.maxTokens ??
          this.config.get<number>("ai.caps.maxTokensOrchestrator") ??
          1024,
        temperature: request.temperature,
      });
      const choice = response.choices[0];
      return {
        content: choice?.message?.content ?? "",
        model: response.model,
        usage: response.usage
          ? {
              promptTokens: response.usage.prompt_tokens,
              completionTokens: response.usage.completion_tokens,
              totalTokens: response.usage.total_tokens,
            }
          : undefined,
      };
    } catch (err) {
      throw mapOpenAiError(err, this.timeoutMs);
    }
  }

  async completeWithTools(
    request: LlmCompleteWithToolsRequest,
  ): Promise<LlmCompleteWithToolsResult> {
    try {
      const toolChoice =
        request.toolChoice === undefined
          ? "auto"
          : request.toolChoice === "auto" || request.toolChoice === "none"
            ? request.toolChoice
            : {
                type: "function" as const,
                function: { name: request.toolChoice.name },
              };

      const response = await this.client.chat.completions.create({
        model: request.model ?? this.defaultModel,
        messages: toOpenAiMessages(request.messages),
        tools: request.tools.map((t) => ({
          type: "function" as const,
          function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          },
        })),
        tool_choice: toolChoice,
        max_tokens:
          request.maxTokens ??
          this.config.get<number>("ai.caps.maxTokensOrchestrator") ??
          1024,
        temperature: request.temperature,
      });

      const message = response.choices[0]?.message;
      const toolCalls: LlmToolCall[] = (message?.tool_calls ?? [])
        .filter((c) => c.type === "function")
        .map((c) => ({
          id: c.id,
          name: c.function.name,
          argumentsJson: c.function.arguments,
        }));

      return {
        content: message?.content ?? "",
        toolCalls,
        model: response.model,
        usage: response.usage
          ? {
              promptTokens: response.usage.prompt_tokens,
              completionTokens: response.usage.completion_tokens,
              totalTokens: response.usage.total_tokens,
            }
          : undefined,
      };
    } catch (err) {
      throw mapOpenAiError(err, this.timeoutMs);
    }
  }
}

export function mapOpenAiError(err: unknown, timeoutMs: number): Error {
  const anyErr = err as {
    status?: number;
    code?: string;
    message?: string;
    name?: string;
  };
  const message = anyErr?.message ?? "OpenAI error";
  if (
    anyErr?.code === "ETIMEDOUT" ||
    anyErr?.name === "APIConnectionTimeoutError" ||
    /timeout/i.test(message)
  ) {
    return new ProviderTimeoutError(
      `OpenAI timeout after ${timeoutMs}ms: ${message}`,
      "openai",
      err,
    );
  }
  if (anyErr?.status === 429) {
    return new ProviderRateLimitError(message, "openai", err);
  }
  return new ProviderUnavailableError(message, "openai", err);
}
