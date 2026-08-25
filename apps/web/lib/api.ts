import type {
  ReasoningTrace,
  RutaOrquestador,
  EstadoBot,
} from "@tres-cielos/shared";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3011";

export interface SandboxTurnData {
  duplicate?: boolean;
  conversacionId?: string;
  textoRespuesta: string;
  ruta: RutaOrquestador;
  estadoBot: EstadoBot;
  motivoHandoff?: string | null;
  eventoOperativoId?: string;
  silencio?: boolean;
  reasoningTraceId?: string | null;
  reasoningTrace?: ReasoningTrace | null;
  registroRecuperacionId?: string | null;
  registroConsultaCatalogoId?: string | null;
  pasoGuion?: string;
}

export async function postSandboxInbound(input: {
  texto: string;
  threadId: string;
  externalMessageId: string;
}): Promise<SandboxTurnData> {
  const res = await fetch(`${API_URL}/channels/sandbox/inbound`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      texto: input.texto,
      canal: "whatsapp",
      externalThreadId: input.threadId,
      externalMessageId: input.externalMessageId,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `HTTP ${res.status}`);
  }
  const json = (await res.json()) as { data: SandboxTurnData };
  return json.data;
}

export async function getReasoningTrace(
  traceId: string,
): Promise<ReasoningTrace> {
  const res = await fetch(`${API_URL}/channels/sandbox/turns/${traceId}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const json = (await res.json()) as { data: ReasoningTrace };
  return json.data;
}
