import type {
  EstadoAtencion,
  EtapaCotizacion,
  TipoInteraccion,
  VisitaEstado,
} from "@tres-cielos/shared";

export const ESTADO_ATENCION_LABEL: Record<EstadoAtencion, string> = {
  nuevo: "Nuevo",
  bot_activo: "Bot activo",
  escalado: "Escalado",
  en_atencion: "En atención",
  cerrado: "Cerrado",
};

export const TIPO_HECHO_LABEL: Record<TipoInteraccion, string> = {
  mensaje: "Mensaje",
  nota: "Nota",
  cambio_estado_atencion: "Estado de atención",
  cambio_etapa: "Etapa",
  handoff: "Handoff",
  toma_control: "Toma de control",
  asignacion: "Asignación",
  plantilla: "Plantilla",
  adjunto: "Adjunto",
  accion_bot: "Acción del bot",
  edicion_ficha: "Edición de ficha",
  posible_duplicado: "Posible duplicado",
  recontacto: "Recontacto",
  intencion_cotizar: "Intención de cotizar",
  brief_actualizado: "Brief actualizado",
  cambio_visita: "Visita",
  propuesta_enviada: "Propuesta enviada",
};

export const ETAPA_COTIZACION_LABEL: Record<EtapaCotizacion, string> = {
  perfilando: "Perfilando",
  explorando: "Explorando catálogo",
  listo_para_cotizar: "Listo para cotizar",
  sin_tarifa: "Sin tarifa publicada",
  propuesta_enviada: "Propuesta enviada",
  negociacion: "Negociación",
  ganado: "Ganado",
  perdido: "Perdido",
};

export const VISITA_LABEL: Record<VisitaEstado, string> = {
  no_solicitada: "Sin visita",
  solicitada: "Visita sin agendar",
  agendada: "Visita agendada",
  realizada: "Visita realizada",
  cancelada: "Visita cancelada",
  no_asistio: "No asistió",
};

export const TIPO_EVENTO_LABEL: Record<string, string> = {
  boda: "Boda",
  xv: "XV años",
  corporativo: "Corporativo",
  social: "Social",
  otro: "Otro",
  multi: "Solo renta",
};

export const COLA_LABEL: Record<string, string> = {
  visitas_sin_agendar: "Visitas sin agendar",
  listos_sin_propuesta: "Listos sin propuesta",
  sin_tarifa: "Sin tarifa",
  escalados: "Escalados",
  atencion_general: "Atención general",
  estancados: "Estancados",
};

export const ETAPA_LABEL: Record<string, string> = {
  nuevo_bot: "Nuevo / bot",
  calificado: "Calificado",
  contactado: "Contactado",
  propuesta: "Propuesta",
  negociacion: "Negociación",
  ganado: "Ganado",
  perdido: "Perdido",
};

export function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function displayName(nombre: string | null, fallback = "Sin nombre"): string {
  const t = nombre?.trim();
  return t ? t : fallback;
}
