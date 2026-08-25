export type Canal = "facebook" | "instagram" | "whatsapp";

export type EstadoBot = "activo" | "escalado" | "humano";

export type RutaOrquestador =
  | "guion"
  | "catalogo"
  | "rag"
  | "handoff"
  | "safe"
  | "silencio";

export interface PerfilCanal {
  nombre?: string | null;
  psid?: string | null;
  waId?: string | null;
}

export interface InboundAdjuntoRef {
  /** Tras put — binario nunca en Postgres */
  storageKey?: string;
  mime: string;
  nombreOriginal?: string;
  /** URL temporal del canal (descargar async) */
  urlExterna?: string;
  bytes?: number;
}

export interface InboundMessage {
  canal: Canal;
  externalThreadId: string;
  externalMessageId: string;
  texto: string;
  recibidoEn: string;
  perfilCanal?: PerfilCanal;
  adjuntos?: InboundAdjuntoRef[];
  /** Metadatos crudos para outbound */
  meta?: Record<string, unknown>;
}

export interface OutboundMessage {
  canal: Canal;
  externalThreadId: string;
  texto: string;
  plantillaUtilityId?: string;
  inReplyToExternalMessageId?: string;
}

export interface TurnResult {
  conversacionId?: string;
  textoRespuesta: string;
  ruta: RutaOrquestador;
  estadoBot: EstadoBot;
  motivoHandoff?: string | null;
  eventoOperativoId?: string;
  silencio?: boolean;
  reasoningTraceId?: string | null;
  reasoningTrace?: import("@tres-cielos/shared").ReasoningTrace | null;
  registroRecuperacionId?: string | null;
  registroConsultaCatalogoId?: string | null;
  pasoGuion?: string;
}
