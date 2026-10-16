import { z } from "zod";
import { MensajeAsesorAdjuntoRefSchema } from "./bandeja-media";
import { ROL_USUARIO } from "./auth";
import {
  FechaEstadoSchema,
  RangoInversionSchema,
  RangoPresupuestoFueraSchema,
} from "./orchestrator";

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
  "atencion_general",
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

export const AUTOR_MENSAJE = ["prospecto", "bot", "asesor"] as const;
export type AutorMensaje = (typeof AUTOR_MENSAJE)[number];

export const DIRECCION_MENSAJE = ["entrante", "saliente"] as const;
export type DireccionMensaje = (typeof DIRECCION_MENSAJE)[number];

export const UltimoMensajeDtoSchema = z.object({
  contenido: z.string(),
  autor: z.enum(AUTOR_MENSAJE),
  direccion: z.enum(DIRECCION_MENSAJE),
  creadoEn: z.string(),
});
export type UltimoMensajeDto = z.infer<typeof UltimoMensajeDtoSchema>;

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
  encajeEconomico: z.string().nullable().optional(),
  intencionNivel: z.string().nullable().optional(),
  rutaComercial: z.string().nullable().optional(),
  conversacionId: z.string().nullable().optional(),
  estadoBot: z.string().nullable().optional(),
  asesorLockId: z.string().nullable().optional(),
  ultimoMensaje: UltimoMensajeDtoSchema.nullable().optional(),
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
  encajeEconomico: z.string().nullable().optional(),
  intencionNivel: z.string().nullable().optional(),
  rutaComercial: z.string().nullable().optional(),
  asesorLockId: z.string().nullable().optional(),
  slaVenceEn: z.string().nullable().optional(),
  motivoHandoff: z.string().nullable().optional(),
  fechaEstado: FechaEstadoSchema.nullable().optional(),
  fechaEvento: z.string().nullable().optional(),
  rangoInversion: RangoInversionSchema.nullable().optional(),
  rangoPresupuestoFuera: RangoPresupuestoFueraSchema.nullable().optional(),
  pdfEnviado: z.boolean().optional(),
});
export type ConversacionResumenDto = z.infer<
  typeof ConversacionResumenDtoSchema
>;

export const BriefCardDtoSchema = z.object({
  nombre: z.string().nullable(),
  ocasion: z.string().nullable(),
  fechaEstado: z.string().nullable(),
  aforo: z.number().nullable(),
  rango: z.string().nullable(),
  encaje: z.string().nullable(),
  intencion: z.string().nullable(),
  ruta: z.string().nullable(),
  ultimaPregunta: z.string().nullable(),
  pdfEnviado: z.boolean(),
});
export type BriefCardDto = z.infer<typeof BriefCardDtoSchema>;

export const BandejaItemSchema = z.object({
  id: z.string(),
  clienteId: z.string().nullable(),
  cola: z.enum(["comercial", "atencion_general"]).nullable(),
  estadoBot: z.string(),
  slaVenceEn: z.string().nullable(),
  asesorLockId: z.string().nullable(),
  urgenciaSla: z.enum(["dentro", "fuera"]).nullable(),
  brief: BriefCardDtoSchema,
});
export type BandejaItem = z.infer<typeof BandejaItemSchema>;

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
  id: z.string().optional(),
  mimeType: z.string(),
  nombreOriginal: z.string().nullable(),
  bytes: z.number().int().nullable().optional(),
  url: z.string().nullable().optional(),
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

export const ENTREGA_MENSAJE_ASESOR = ["enviado", "omitido", "sandbox"] as const;
export type EntregaMensajeAsesor = (typeof ENTREGA_MENSAJE_ASESOR)[number];

export const EnviarMensajeAsesorRequestSchema = z
  .object({
    contenido: z.string().trim().max(4096).optional(),
    adjuntos: z.array(MensajeAsesorAdjuntoRefSchema).max(10).optional(),
  })
  .superRefine((data, ctx) => {
    const texto = data.contenido?.trim() ?? "";
    const adj = data.adjuntos?.length ?? 0;
    if (!texto && adj === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "CONTENIDO_O_ADJUNTO_REQUERIDO",
      });
    }
  });
export type EnviarMensajeAsesorRequest = z.infer<
  typeof EnviarMensajeAsesorRequestSchema
>;

export const MensajeAsesorDtoSchema = z.object({
  id: z.string(),
  contenido: z.string(),
  autor: z.literal("asesor"),
  direccion: z.literal("saliente"),
  creadoEn: z.string(),
  conversacionId: z.string(),
});
export type MensajeAsesorDto = z.infer<typeof MensajeAsesorDtoSchema>;

export const EnviarMensajeAsesorResponseSchema = z.object({
  mensaje: MensajeAsesorDtoSchema,
  estadoBot: z.literal("humano"),
  entrega: z.enum(ENTREGA_MENSAJE_ASESOR),
});
export type EnviarMensajeAsesorResponse = z.infer<
  typeof EnviarMensajeAsesorResponseSchema
>;

export const ActualizarBriefRequestSchema = z
  .object({
    nombre: z.string().trim().min(1).max(200).nullable().optional(),
    tipoEvento: TipoEventoCrmSchema.nullable().optional(),
    fechaTentativa: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
    fechaEstado: FechaEstadoSchema.nullable().optional(),
    aforo: z.number().int().min(1).max(5000).nullable().optional(),
    rangoInversion: RangoInversionSchema.nullable().optional(),
    rangoPresupuestoFuera: RangoPresupuestoFueraSchema.nullable().optional(),
  })
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    message: "BRIEF_VACIO",
  });
export type ActualizarBriefRequest = z.infer<
  typeof ActualizarBriefRequestSchema
>;
