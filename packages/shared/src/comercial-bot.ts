import { z } from "zod";
import type {
  FechaEstado,
  RangoInversion,
  RangoPresupuestoFuera,
  RutaComercial,
} from "./orchestrator";

/** CTA del guion (visita, ejecutivo, fuera de presupuesto). */
export const CTA_GUION = ["visita", "ejecutivo", "fuera_presupuesto"] as const;
export type CtaGuion = (typeof CTA_GUION)[number];

/** Lenguaje del bot, compartido por API y panel. */
export const CTA_GUION_LABEL: Record<CtaGuion, string> = {
  visita: "Agendar visita",
  ejecutivo: "Hablar con un ejecutivo",
  fuera_presupuesto: "Fuera de presupuesto",
};

export const RUTA_COMERCIAL_LABEL: Record<RutaComercial, string> = {
  handoff: "Hablar con un ejecutivo",
  atencion_general: "Atención general",
  seguimiento: "Seguimiento",
  nutricion: "Nutrición",
  cierre: "Cierre",
};

export const PASO_GUION_LABEL: Record<string, string> = {
  saludo: "Saludo",
  nombre: "Nombre",
  ocasion: "Ocasión",
  fecha: "Fecha del evento",
  aforo: "Aforo",
  sede: "Sede",
  presupuesto: "Presupuesto",
  intencion: "Intención",
  nombre_fecha: "Nombre y fecha",
  fecha_ventana: "Ventana de fecha",
  aforo_inversion: "Invitados e inversión",
  aclaracion_piso: "Piso de inversión",
  accion: "Cómo seguir",
  presupuesto_fuera: "Fuera de presupuesto",
  faq_libre: "Preguntas abiertas",
};

export const RANGO_INVERSION_LABEL: Record<RangoInversion, string> = {
  r250_349: "250–349 mil",
  r350_499: "350–499 mil",
  r500_mas: "500 mil o más",
  por_definir: "Por definir",
  menor_250: "Menos de 250 mil",
};

export const RANGO_PRESUPUESTO_FUERA_LABEL: Record<RangoPresupuestoFuera, string> = {
  r200_250: "200–250 mil",
  r250_300: "250–300 mil",
  fuera_rango: "Fuera de rango",
};

export const FECHA_ESTADO_LABEL: Record<FechaEstado, string> = {
  definida: "Definida",
  ventana: "Ventana",
  tentativa: "Tentativa",
  sin_definir: "Sin definir",
};

export const VISITA_ESTADO_LABEL = {
  no_solicitada: "Sin visita",
  solicitada: "Visita sin agendar",
  agendada: "Visita agendada",
  realizada: "Visita realizada",
  cancelada: "Visita cancelada",
  no_asistio: "No asistió",
} as const;

export function labelPresupuestoBrief(conv: {
  rangoInversion?: RangoInversion | string | null;
  rangoPresupuestoFuera?: RangoPresupuestoFuera | string | null;
}): string | null {
  if (conv.rangoPresupuestoFuera && conv.rangoPresupuestoFuera in RANGO_PRESUPUESTO_FUERA_LABEL) {
    return RANGO_PRESUPUESTO_FUERA_LABEL[
      conv.rangoPresupuestoFuera as RangoPresupuestoFuera
    ];
  }
  if (conv.rangoInversion && conv.rangoInversion in RANGO_INVERSION_LABEL) {
    return RANGO_INVERSION_LABEL[conv.rangoInversion as RangoInversion];
  }
  return null;
}

export const CAPTURA_COMERCIAL_ID = ["fecha", "presupuesto", "accion"] as const;
export type CapturaComercialId = (typeof CAPTURA_COMERCIAL_ID)[number];

export const CAPTURA_ESTADO = ["ok", "pendiente", "na"] as const;
export type CapturaEstado = (typeof CAPTURA_ESTADO)[number];

export const ResumenComercialCapturaSchema = z.object({
  id: z.enum(CAPTURA_COMERCIAL_ID),
  etiqueta: z.string(),
  valor: z.string().nullable(),
  estado: z.enum(CAPTURA_ESTADO),
});
export type ResumenComercialCaptura = z.infer<typeof ResumenComercialCapturaSchema>;

/**
 * Vista comercial del hilo: no sustituye `etapaCotizacion` ni las colas.
 * Resume fecha, presupuesto y la acción que el bot ya ofreció.
 */
export const ResumenComercialBotSchema = z.object({
  titulo: z.string(),
  subtitulo: z.string().nullable(),
  capturas: z.array(ResumenComercialCapturaSchema).length(3),
  siguienteParaAsesor: z.string(),
});
export type ResumenComercialBot = z.infer<typeof ResumenComercialBotSchema>;
