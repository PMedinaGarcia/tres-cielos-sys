import type {
  EstadoAtencion,
  EtapaCotizacion,
  RangoInversion,
  TipoInteraccion,
  VisitaEstado,
} from "@tres-cielos/shared";
import {
  CTA_GUION_LABEL,
  FECHA_ESTADO_LABEL,
  PASO_GUION_LABEL,
  RANGO_INVERSION_LABEL,
  RANGO_PRESUPUESTO_FUERA_LABEL,
  RUTA_COMERCIAL_LABEL,
  VISITA_ESTADO_LABEL,
  labelPresupuestoBrief,
} from "@tres-cielos/shared";

export {
  CTA_GUION_LABEL,
  FECHA_ESTADO_LABEL,
  PASO_GUION_LABEL,
  RANGO_INVERSION_LABEL,
  RANGO_PRESUPUESTO_FUERA_LABEL,
  RUTA_COMERCIAL_LABEL,
  labelPresupuestoBrief,
};

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

export const VISITA_LABEL: Record<VisitaEstado, string> = VISITA_ESTADO_LABEL;

/** Textos cortos para paneles laterales y selects en columnas angostas. */
export const ETAPA_COTIZACION_LABEL_COMPACT: Record<EtapaCotizacion, string> = {
  perfilando: "Perfilando",
  explorando: "Catálogo",
  listo_para_cotizar: "Listo cotizar",
  sin_tarifa: "Sin tarifa",
  propuesta_enviada: "Propuesta",
  negociacion: "Negociación",
  ganado: "Ganado",
  perdido: "Perdido",
};

export const VISITA_LABEL_COMPACT: Record<VisitaEstado, string> = {
  no_solicitada: "Sin visita",
  solicitada: "Sin agendar",
  agendada: "Agendada",
  realizada: "Realizada",
  cancelada: "Cancelada",
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

/** Valor del `<select>` de presupuesto en bandeja (`pf:` = fuera de piso comercial). */
export function presupuestoBriefSelectValue(conv: {
  rangoInversion?: RangoInversion | null;
  rangoPresupuestoFuera?: string | null;
}): string {
  if (conv.rangoPresupuestoFuera) return `pf:${conv.rangoPresupuestoFuera}`;
  if (conv.rangoInversion) return `inv:${conv.rangoInversion}`;
  return "";
}

export const ETAPA_LABEL: Record<string, string> = {
  nuevo_bot: "Nuevo / bot",
  calificado: "Calificado",
  contactado: "Contactado",
  propuesta: "Propuesta",
  negociacion: "Negociación",
  ganado: "Ganado",
  perdido: "Perdido",
};

export function formatRelativo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diff = now - d.getTime();
  if (diff >= 0 && diff < 60_000) return "ahora";
  if (diff >= 0 && diff < 60 * 60_000) {
    const min = Math.max(1, Math.floor(diff / 60_000));
    return `${min} min`;
  }
  const hoy = new Date(now);
  if (d.toDateString() === hoy.toDateString()) {
    return d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  }
  const ayer = new Date(now);
  ayer.setDate(ayer.getDate() - 1);
  if (d.toDateString() === ayer.toDateString()) return "ayer";
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

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
