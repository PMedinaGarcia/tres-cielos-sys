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
    const text = (lastUser?.content ?? "").toLowerCase();
    const available = new Set(request.tools.map((t) => t.name));
    const toolCalls = planTools(text, available);

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

function planTools(text: string, available: Set<string>): LlmToolCall[] {
  const skuMatch = text.toUpperCase().match(/\b([A-Z]{2,}(?:-[A-Z0-9]+)+)\b/);
  const sku = skuMatch?.[1];

  if (/hablar con|asesor|humano|persona real|agente/.test(text)) {
    if (available.has("transferir_a_humano")) {
      return [
        call("transferir_a_humano", { motivo: "solicitud_usuario" }),
      ];
    }
  }

  if (/compar(a|ar)|diferencia/.test(text) && available.has("comparar_paquetes")) {
    const skus = [
      ...text.toUpperCase().matchAll(/\b([A-Z]{2,}(?:-[A-Z0-9]+)+)\b/g),
    ].map((m) => m[1]);
    return [call("comparar_paquetes", { skus: skus.slice(0, 3) })];
  }

  if (/incluye|inclusiones|qué trae|que trae/.test(text) && sku) {
    if (available.has("listar_inclusiones")) {
      return [call("listar_inclusiones", { sku })];
    }
  }

  if (/regla|anticipo|fin de semana|feriado/.test(text) && sku) {
    if (available.has("evaluar_reglas_paquete")) {
      return [call("evaluar_reglas_paquete", { sku })];
    }
  }

  if (
    /precio|cuesta|cuánto|cuanto|kuanto|custa|costo|cotiz|paquete/.test(text) &&
    sku &&
    available.has("obtener_precio_paquete")
  ) {
    return [call("obtener_precio_paquete", { sku })];
  }

  if (
    /paquete|buscar|opciones|boda|xv|corporativo/.test(text) &&
    available.has("buscar_paquetes")
  ) {
    let tipoEvento = "boda";
    if (/\bxv\b|quince/.test(text)) tipoEvento = "xv";
    if (/corporativ/.test(text)) tipoEvento = "corporativo";
    const aforoMatch = text.match(/\b(\d{2,4})\b/);
    return [
      call("buscar_paquetes", {
        tipoEvento,
        ...(aforoMatch ? { aforo: Number(aforoMatch[1]) } : {}),
      }),
    ];
  }

  if (sku && available.has("obtener_precio_paquete")) {
    return [call("obtener_precio_paquete", { sku })];
  }

  return [];
}

function call(name: string, args: Record<string, unknown>): LlmToolCall {
  return {
    id: `call_${randomUUID().slice(0, 8)}`,
    name,
    argumentsJson: JSON.stringify(args),
  };
}
