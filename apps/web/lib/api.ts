import type {
  ReasoningTrace,
  RutaOrquestador,
  EstadoBot,
  WaContent,
} from "@tres-cielos/shared";
import { apiFetch, readJson } from "./http";

export { API_URL } from "./http";

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
  waContent?: WaContent | null;
}

export async function postSandboxInbound(input: {
  texto: string;
  threadId: string;
  externalMessageId: string;
  buttonPayload?: string;
}): Promise<SandboxTurnData> {
  const res = await apiFetch("/channels/sandbox/inbound", {
    method: "POST",
    body: JSON.stringify({
      texto: input.texto,
      canal: "whatsapp",
      externalThreadId: input.threadId,
      externalMessageId: input.externalMessageId,
      ...(input.buttonPayload ? { buttonPayload: input.buttonPayload } : {}),
    }),
  });
  const json = await readJson<{ data: SandboxTurnData }>(res);
  return json.data;
}

export async function getReasoningTrace(
  traceId: string,
): Promise<ReasoningTrace> {
  const res = await apiFetch(`/channels/sandbox/turns/${traceId}`, {
    cache: "no-store",
  });
  const json = await readJson<{ data: ReasoningTrace }>(res);
  return json.data;
}
