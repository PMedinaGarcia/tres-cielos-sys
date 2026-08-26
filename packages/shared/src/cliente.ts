import { z } from "zod";
import { ROL_USUARIO } from "./auth";

export const ESTADO_ATENCION = [
  "nuevo",
  "bot_activo",
  "escalado",
  "en_atencion",
  "cerrado",
] as const;
export type EstadoAtencion = (typeof ESTADO_ATENCION)[number];
export const EstadoAtencionSchema = z.enum(ESTADO_ATENCION);

export const FUENTE_ALTA = ["bot", "asesor", "importacion"] as const;
export type FuenteAlta = (typeof FUENTE_ALTA)[number];
export const FuenteAltaSchema = z.enum(FUENTE_ALTA);

export const TIPO_IDENTIFICADOR_CLIENTE = [
  "telefono",
  "wa_id",
  "meta_psid",
  "ig_scoped_id",
  "email",
  "sandbox_thread",
] as const;
export type TipoIdentificadorCliente =
  (typeof TIPO_IDENTIFICADOR_CLIENTE)[number];
export const TipoIdentificadorClienteSchema = z.enum(
  TIPO_IDENTIFICADOR_CLIENTE,
);

export const TIPO_INTERACCION = [
  "mensaje",
  "nota",
  "cambio_estado_atencion",
  "cambio_etapa",
  "handoff",
  "toma_control",
  "asignacion",
  "plantilla",
  "adjunto",
  "accion_bot",
  "edicion_ficha",
  "posible_duplicado",
  "recontacto",
  "intencion_cotizar",
  "brief_actualizado",
  "cambio_visita",
  "propuesta_enviada",
] as const;
export type TipoInteraccion = (typeof TIPO_INTERACCION)[number];
export const TipoInteraccionSchema = z.enum(TIPO_INTERACCION);

export const ACTOR_OPERATIVO = [
  "bot",
  "asesor",
  "coordinador",
  "admin",
  "sistema",
] as const;
export type ActorOperativoCrm = (typeof ACTOR_OPERATIVO)[number];
export const ActorOperativoCrmSchema = z.enum(ACTOR_OPERATIVO);

export const CANAL_CRM = [
  "facebook",
  "instagram",
  "whatsapp",
  "sandbox",
] as const;
export type CanalCrm = (typeof CANAL_CRM)[number];
export const CanalCrmSchema = z.enum(CANAL_CRM);

export const TIPO_EVENTO = [
  "boda",
  "xv",
  "corporativo",
  "social",
  "otro",
  "multi",
] as const;
export type TipoEventoCrm = (typeof TIPO_EVENTO)[number];
export const TipoEventoCrmSchema = z.enum(TIPO_EVENTO);

export const VISITA_ESTADO = [
  "no_solicitada",
  "solicitada",
  "agendada",
  "realizada",
  "cancelada",
  "no_asistio",
] as const;
export type VisitaEstado = (typeof VISITA_ESTADO)[number];
export const VisitaEstadoSchema = z.enum(VISITA_ESTADO);

export const ETAPA_COTIZACION = [
  "perfilando",
  "explorando",
  "listo_para_cotizar",
  "sin_tarifa",
  "propuesta_enviada",
  "negociacion",
  "ganado",
  "perdido",
] as const;
export type EtapaCotizacion = (typeof ETAPA_COTIZACION)[number];
export const EtapaCotizacionSchema = z.enum(ETAPA_COTIZACION);

export const ETAPA_PIPELINE = [
  "nuevo_bot",
  "calificado",
  "contactado",
  "propuesta",
  "negociacion",
  "ganado",
  "perdido",
] as const;
export type EtapaPipeline = (typeof ETAPA_PIPELINE)[number];
export const EtapaPipelineSchema = z.enum(ETAPA_PIPELINE);

export const MOTIVO_PERDIDO = [
  "precio",
  "fecha",
  "competencia",
  "sin_respuesta",
  "otro",
] as const;
export type MotivoPerdido = (typeof MOTIVO_PERDIDO)[number];
export const MotivoPerdidoSchema = z.enum(MOTIVO_PERDIDO);

export const COLA_CRM = [
  "visitas_sin_agendar",
  "listos_sin_propuesta",
  "sin_tarifa",
  "escalados",
  "estancados",
] as const;
export type ColaCrm = (typeof COLA_CRM)[number];
export const ColaCrmSchema = z.enum(COLA_CRM);

export const IdentificadorClienteDtoSchema = z.object({
  id: z.string(),
  tipo: TipoIdentificadorClienteSchema,
  valor: z.string(),
  valorNormalizado: z.string(),
  creadoEn: z.string(),
});
export type IdentificadorClienteDto = z.infer<
  typeof IdentificadorClienteDtoSchema
>;

export const ClienteListItemSchema = z.object({
  id: z.string(),
  nombre: z.string().nullable(),
  telefono: z.string().nullable(),
  correo: z.string().nullable(),
  estadoAtencion: EstadoAtencionSchema,
  asesorAsignadoId: z.string().nullable(),
  canalOrigen: CanalCrmSchema.nullable(),
  fuenteAlta: FuenteAltaSchema,
  tags: z.array(z.string()),
  primerContactoEn: z.string(),
  ultimoContactoEn: z.string(),
  optOutMensajeria: z.boolean(),
  tieneDuplicado: z.boolean(),
  tipoEvento: z.string().nullable(),
  etapaCotizacion: EtapaCotizacionSchema.nullable(),
  visitaEstado: VisitaEstadoSchema,
  listoParaCotizar: z.boolean(),
  siguienteAccion: z.string(),
  estancado: z.boolean(),
  oportunidadId: z.string().nullable(),
});
export type ClienteListItem = z.infer<typeof ClienteListItemSchema>;

export const OportunidadResumenDtoSchema = z.object({
  id: z.string(),
  etapa: z.string(),
  tipoEvento: z.string().nullable(),
  calificacion: z.string(),
  listoParaCotizar: z.boolean(),
  asesorAsignadoId: z.string().nullable(),
  fechaTentativa: z.string().nullable(),
  aforo: z.number().nullable(),
  sede: z.string().nullable(),
  intencionVisita: z.boolean(),
  visitaEstado: VisitaEstadoSchema,
  visitaAgendadaEn: z.string().nullable(),
  visitaNotas: z.string().nullable(),
  propuestaEnviadaEn: z.string().nullable(),
  etapaCotizacion: EtapaCotizacionSchema,
  paqueteTentativoId: z.string().nullable(),
  motivoPerdido: z.string().nullable(),
  siguienteAccion: z.string(),
  estancado: z.boolean(),
  briefJson: z.unknown().nullable(),
});
export type OportunidadResumenDto = z.infer<typeof OportunidadResumenDtoSchema>;

export const ConversacionResumenDtoSchema = z.object({
  id: z.string(),
  canal: CanalCrmSchema,
  externalThreadId: z.string().nullable(),
  estadoBot: z.string(),
});
export type ConversacionResumenDto = z.infer<
  typeof ConversacionResumenDtoSchema
>;

export const NotaClienteDtoSchema = z.object({
  id: z.string(),
  autorId: z.string(),
  cuerpo: z.string(),
  creadoEn: z.string(),
});
export type NotaClienteDto = z.infer<typeof NotaClienteDtoSchema>;

export const VinculoClienteDtoSchema = z.object({
  clienteId: z.string(),
  relacion: z.enum(["posible_duplicado", "canonico"]),
  nombre: z.string().nullable(),
  telefono: z.string().nullable(),
  primerContactoEn: z.string(),
});
export type VinculoClienteDto = z.infer<typeof VinculoClienteDtoSchema>;

export const ClienteDetailSchema = ClienteListItemSchema.extend({
  nombrePerfilCanal: z.string().nullable(),
  sedeInteresId: z.string().nullable(),
  idioma: z.string().nullable(),
  zonaHoraria: z.string().nullable(),
  origenJson: z.unknown().nullable(),
  fusionadoEnClienteId: z.string().nullable(),
  identificadores: z.array(IdentificadorClienteDtoSchema),
  notas: z.array(NotaClienteDtoSchema),
  oportunidades: z.array(OportunidadResumenDtoSchema),
  conversaciones: z.array(ConversacionResumenDtoSchema),
  vinculos: z.array(VinculoClienteDtoSchema),
  creadoEn: z.string(),
  actualizadoEn: z.string(),
});
export type ClienteDetail = z.infer<typeof ClienteDetailSchema>;

export const InteraccionDtoSchema = z.object({
  id: z.string(),
  clienteId: z.string(),
  oportunidadId: z.string().nullable(),
  conversacionId: z.string().nullable(),
  mensajeId: z.string().nullable(),
  eventoOperativoId: z.string().nullable(),
  tipo: TipoInteraccionSchema,
  actor: ActorOperativoCrmSchema,
  canal: CanalCrmSchema.nullable(),
  resumen: z.string(),
  payload: z.unknown(),
  creadoEn: z.string(),
});
export type InteraccionDto = z.infer<typeof InteraccionDtoSchema>;

export const ActualizarClienteRequestSchema = z.object({
  nombre: z.string().min(1).optional(),
  correo: z.string().email().nullable().optional(),
  sedeInteresId: z.string().nullable().optional(),
  optOutMensajeria: z.boolean().optional(),
  idioma: z.string().min(2).optional(),
  zonaHoraria: z.string().optional(),
});
export type ActualizarClienteRequest = z.infer<
  typeof ActualizarClienteRequestSchema
>;

export const ActualizarOportunidadRequestSchema = z.object({
  visitaEstado: VisitaEstadoSchema.optional(),
  visitaAgendadaEn: z.string().nullable().optional(),
  visitaNotas: z.string().max(2000).nullable().optional(),
  marcarPropuestaEnviada: z.boolean().optional(),
  etapa: EtapaPipelineSchema.optional(),
  motivoPerdido: MotivoPerdidoSchema.nullable().optional(),
});
export type ActualizarOportunidadRequest = z.infer<
  typeof ActualizarOportunidadRequestSchema
>;

export const CrearNotaClienteRequestSchema = z.object({
  cuerpo: z.string().min(1).max(8000),
});
export type CrearNotaClienteRequest = z.infer<
  typeof CrearNotaClienteRequestSchema
>;

export const ReemplazarTagsRequestSchema = z.object({
  tags: z.array(z.string().min(1).max(64)).max(30),
});
export type ReemplazarTagsRequest = z.infer<typeof ReemplazarTagsRequestSchema>;

export const HISTORIAL_KIND = ["mensaje", "hecho"] as const;
export type HistorialKind = (typeof HISTORIAL_KIND)[number];

export const HistorialAdjuntoDtoSchema = z.object({
  mimeType: z.string(),
  nombreOriginal: z.string().nullable(),
});
export type HistorialAdjuntoDto = z.infer<typeof HistorialAdjuntoDtoSchema>;

export const HistorialItemDtoSchema = z.object({
  id: z.string(),
  kind: z.enum(HISTORIAL_KIND),
  tipo: TipoInteraccionSchema,
  actor: z.string(),
  canal: CanalCrmSchema.nullable(),
  creadoEn: z.string(),
  contenido: z.string(),
  conversacionId: z.string().nullable(),
  mensajeId: z.string().nullable(),
  oportunidadId: z.string().nullable(),
  vinculo: z.enum(["propio", "posible_duplicado"]),
  vinculoClienteId: z.string().nullable(),
  direccion: z.enum(["entrante", "saliente"]).nullable(),
  autorMensaje: z.enum(["prospecto", "bot", "asesor"]).nullable(),
  adjuntos: z.array(HistorialAdjuntoDtoSchema),
  payload: z.unknown().optional(),
});
export type HistorialItemDto = z.infer<typeof HistorialItemDtoSchema>;

export const ROLES_CRM_PANEL = ROL_USUARIO;
