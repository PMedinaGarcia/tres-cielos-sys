/** Tipos de dominio del orquestador (alineados a docs/backend/05). */

export type Canal = "whatsapp" | "messenger" | "instagram" | "web";

export type EstadoBot = "activo" | "escalado" | "humano";

export type RutaOrquestador = "guion" | "catalogo" | "rag" | "handoff" | "safe";

export type MotivoHandoff =
  | "solicitud_usuario"
  | "rerank_bajo"
  | "sin_catalogo"
  | "sin_cita_rag"
  | "conflicto"
  | "queja"
  | "descuento_fuera_catalogo"
  | "sede_no_cubierta"
  | "ambiguedad"
  | "adjunto_no_soportado"
  | "material_ocr_tarifas"
  | "proveedor_ia"
  | "cupo_ia"
  | "otro";

export type PasoGuion =
  | "saludo"
  | "nombre"
  | "ocasion"
  | "fecha"
  | "aforo"
  | "sede"
  | "presupuesto"
  | "intencion"
  | "faq_libre";

export type IntentClasificado =
  | "guion_captura"
  | "solicitud_humana"
  | "datos_duros"
  | "pregunta_documental"
  | "ambiguo";

export interface FechaTentativa {
  tipo: "dia" | "rango" | "mes";
  fecha?: string;
  desde?: string;
  hasta?: string;
  anio?: number;
  mes?: number;
  flexible: boolean;
}

export interface PresupuestoOrientativo {
  tipo: "rango" | "no_definido";
  min?: number;
  max?: number;
  moneda?: "MXN";
}

export interface CamposCapturados {
  nombre?: string | null;
  telefono?: string | null;
  tipoEvento?: string | null;
  fechaTentativa?: FechaTentativa | null;
  aforo?: number | null;
  sedeId?: string | null;
  sedeNombre?: string | null;
  presupuestoOrientativo?: PresupuestoOrientativo | null;
  intencionCotizar?: boolean | null;
}

export interface AdjuntoInbound {
  mimeType: string;
  sizeBytes?: number;
  duracionSec?: number;
  storageKey?: string;
}

export interface InboundMessage {
  canal: Canal | string;
  externalThreadId: string;
  externalMessageId: string;
  texto: string;
  recibidoEn: string;
  perfilCanal?: {
    nombre?: string | null;
    psid?: string | null;
    waId?: string | null;
  };
  adjuntos?: AdjuntoInbound[];
}

export interface TurnResponse {
  conversacionId: string;
  mensajeSalienteId: string | null;
  textoRespuesta: string;
  ruta: RutaOrquestador | "silencio";
  estadoBot: EstadoBot;
  eventoOperativoId: string | null;
  registroConsultaCatalogoId: string | null;
  registroRecuperacionId?: string | null;
  motivoHandoff: MotivoHandoff | null;
  pasoGuion?: PasoGuion;
  reasoningTraceId?: string | null;
  reasoningTrace?: import("@tres-cielos/shared").ReasoningTrace | null;
}

export interface ConversacionState {
  id: string;
  canal: string;
  externalThreadId: string;
  estadoBot: EstadoBot;
  pasoGuion: PasoGuion;
  camposCapturados: CamposCapturados;
  paqueteTentativoId: string | null;
  ultimaRuta: RutaOrquestador | null;
  motivoHandoff: MotivoHandoff | null;
  escaladoEn: string | null;
  oportunidadId: string;
  brief: Record<string, unknown>;
  calificado: boolean;
  listoParaCotizar: boolean;
  mensajes: MensajeRecord[];
  creadoEn: string;
  actualizadoEn: string;
}

export interface MensajeRecord {
  id: string;
  direccion: "entrante" | "saliente";
  autor: "prospecto" | "bot" | "asesor";
  contenido: string;
  timestamp: string;
  externalMessageId?: string;
  ruta?: RutaOrquestador;
  consumioCupo: boolean;
}

export interface EventoOperativoRecord {
  id: string;
  tipo: string;
  actor: "bot" | "sistema";
  timestamp: string;
  conversacionId: string;
  mensajeId?: string;
  oportunidadId?: string;
  payload: Record<string, unknown>;
}
