import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import type {
  LlmCompletion,
  LlmMessage,
  LlmPort,
  LlmToolDefinition,
} from "./llm.port";

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
    const text = (lastUser?.content ?? "").toLowerCase();
    const available = new Set(input.tools.map((t) => t.function.name));

    const skuMatch = text.toUpperCase().match(/\b([A-Z]{2,}(?:-[A-Z0-9]+)+)\b/);
    const sku = skuMatch?.[1];

    if (/hablar con|asesor|humano|persona real|agente/.test(text)) {
      if (available.has("transferir_a_humano")) {
        return toolCall("transferir_a_humano", {
          motivo: "solicitud_usuario",
        });
      }
    }

    if (/compar(a|ar)|diferencia/.test(text) && available.has("comparar_paquetes")) {
      const skus = [...text.toUpperCase().matchAll(/\b([A-Z]{2,}(?:-[A-Z0-9]+)+)\b/g)].map(
        (m) => m[1],
      );
      return toolCall("comparar_paquetes", {
        skus: skus.slice(0, 3),
      });
    }

    if (/incluye|inclusiones|qué trae|que trae/.test(text) && sku) {
      if (available.has("listar_inclusiones")) {
        return toolCall("listar_inclusiones", { sku });
      }
    }

    if (/regla|anticipo|fin de semana|feriado/.test(text) && sku) {
      if (available.has("evaluar_reglas_paquete")) {
        return toolCall("evaluar_reglas_paquete", { sku });
      }
    }

    if (
      /precio|cuesta|cuánto|cuanto|costo|cotiz|paquete/.test(text) &&
      sku &&
      available.has("obtener_precio_paquete")
    ) {
      return toolCall("obtener_precio_paquete", { sku });
    }

    if (
      /paquete|buscar|opciones|boda|xv|corporativo/.test(text) &&
      available.has("buscar_paquetes")
    ) {
      let tipoEvento = "boda";
      if (/\bxv\b|quince/.test(text)) tipoEvento = "xv";
      if (/corporativ/.test(text)) tipoEvento = "corporativo";
      const aforoMatch = text.match(/\b(\d{2,4})\b/);
      return toolCall("buscar_paquetes", {
        tipoEvento,
        ...(aforoMatch ? { aforo: Number(aforoMatch[1]) } : {}),
      });
    }

    if (sku && available.has("obtener_precio_paquete")) {
      return toolCall("obtener_precio_paquete", { sku });
    }

    return {
      content: null,
      toolCalls: [],
      usage: { promptTokens: 12, completionTokens: 0 },
    };
  }
}

function toolCall(
  name: string,
  args: Record<string, unknown>,
): LlmCompletion {
  return {
    content: null,
    toolCalls: [
      {
        id: `call_${randomUUID().slice(0, 8)}`,
        type: "function",
        function: { name, arguments: JSON.stringify(args) },
      },
    ],
    usage: { promptTokens: 20, completionTokens: 8 },
  };
}
