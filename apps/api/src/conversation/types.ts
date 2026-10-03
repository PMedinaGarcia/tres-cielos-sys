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
  | "nombre_fecha"
  | "fecha_ventana"
  | "aforo_inversion"
  | "aclaracion_piso"
  | "accion"
  | "presupuesto_fuera"
  | "faq_libre";

export type EncajeEconomico =
  | "confirmado"
  | "probable"
  | "no_confirmado"
  | "no";

export type IntencionNivel = "alta" | "media" | "baja";

export type RangoInversion =
  | "r250_349"
  | "r350_499"
  | "r500_mas"
  | "por_definir"
  | "menor_250";

export type FechaEstado = "definida" | "ventana" | "tentativa" | "sin_definir";

export type FechaTipo = "sabado" | "viernes" | "otro";

export type AforoBanda = 100 | 150 | 200 | 250 | 300;

export type ColaAsesor = "comercial" | "atencion_general";

export type GuionVersion = "v1" | "v2" | "v3" | "v4";

export type CtaGuion = "visita" | "ejecutivo" | "fuera_presupuesto";

/** Rango declarado tras CTA «Fuera de presupuesto» (v4). */
export type RangoPresupuestoFuera = "r200_250" | "r250_300" | "fuera_rango";

export type RutaComercial =
  | "handoff"
  | "atencion_general"
  | "seguimiento"
  | "nutricion"
  | "cierre";

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
  intencionVisita?: boolean | null;
  encajeEconomico?: EncajeEconomico | null;
  intencionNivel?: IntencionNivel | null;
  rangoInversion?: RangoInversion | null;
  aceptaPiso250k?: boolean | null;
  fechaEstado?: FechaEstado | null;
  rutaComercial?: RutaComercial | null;
  consentimientoSeguimiento?: boolean | null;
  numeroAclaracionesPiso?: number | null;
  numeroMensajesCaptura?: number | null;
  fechaTipo?: FechaTipo | null;
  ventanaVisita?: string | null;
  aforoBanda?: AforoBanda | null;
  origenZona?: string | null;
  email?: string | null;
  pdfEnviado?: boolean | null;
  adjuntoReintentos?: number | null;
  ctaGuion?: CtaGuion | null;
  rangoPresupuestoFuera?: RangoPresupuestoFuera | null;
}

export interface AdjuntoInbound {
  mimeType: string;
  sizeBytes?: number;
  duracionSec?: number;
  storageKey?: string;
  nombreOriginal?: string;
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
  buttonPayload?: string;
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
  waContent?: import("@tres-cielos/shared").WaContent | null;
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
  pedidoCotizacion?: boolean | null;
  pedidoCotizacionFuente?: string | null;
  mensajes: MensajeRecord[];
  creadoEn: string;
  actualizadoEn: string;
  guionVersion?: GuionVersion | null;
  asesorLockId?: string | null;
  slaVenceEn?: string | null;
  cola?: ColaAsesor | null;
  /** Resumen durable del perfil de cliente. */
  resumenMemoria?: string | null;
  /** Últimos mensajes de la oportunidad, de cualquier canal. */
  ventanaContexto?: Array<{
    autor: "prospecto" | "bot" | "asesor";
    contenido: string;
  }>;
  /** El turno abre con saludo y sigue en el paso guardado. */
  reanudarSesion?: boolean;
  /** Nombre y wa_id del perfil de WhatsApp. No sustituye el nombre dicho en el guion. */
  perfilCanal?: {
    nombre?: string | null;
    psid?: string | null;
    waId?: string | null;
  };
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
  plantillaUtilityId?: string | null;
  adjuntos?: AdjuntoInbound[];
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
