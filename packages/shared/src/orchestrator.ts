import { z } from "zod";

export const RutaOrquestadorSchema = z.enum([
  "guion",
  "catalogo",
  "rag",
  "handoff",
  "safe",
  "silencio",
]);
export type RutaOrquestador = z.infer<typeof RutaOrquestadorSchema>;

export const EstadoBotSchema = z.enum(["activo", "escalado", "humano"]);
export type EstadoBot = z.infer<typeof EstadoBotSchema>;

export const PasoGuionSchema = z.enum([
  "saludo",
  "nombre",
  "ocasion",
  "fecha",
  "aforo",
  "sede",
  "presupuesto",
  "intencion",
  "nombre_fecha",
  "fecha_ventana",
  "aforo_inversion",
  "aclaracion_piso",
  "accion",
  "faq_libre",
]);
export type PasoGuion = z.infer<typeof PasoGuionSchema>;

export const EncajeEconomicoSchema = z.enum([
  "confirmado",
  "probable",
  "no_confirmado",
  "no",
]);
export type EncajeEconomico = z.infer<typeof EncajeEconomicoSchema>;

export const IntencionNivelSchema = z.enum(["alta", "media", "baja"]);
export type IntencionNivel = z.infer<typeof IntencionNivelSchema>;

export const RangoInversionSchema = z.enum([
  "r250_349",
  "r350_499",
  "r500_mas",
  "por_definir",
  "menor_250",
]);
export type RangoInversion = z.infer<typeof RangoInversionSchema>;

export const FechaTipoSchema = z.enum(["sabado", "viernes", "otro"]);
export type FechaTipo = z.infer<typeof FechaTipoSchema>;

export const AforoBandaSchema = z.union([
  z.literal(100),
  z.literal(150),
  z.literal(200),
  z.literal(250),
  z.literal(300),
]);
export type AforoBanda = z.infer<typeof AforoBandaSchema>;

export const FechaEstadoSchema = z.enum([
  "definida",
  "ventana",
  "tentativa",
  "sin_definir",
]);
export type FechaEstado = z.infer<typeof FechaEstadoSchema>;

export const RutaComercialSchema = z.enum([
  "handoff",
  "atencion_general",
  "seguimiento",
  "nutricion",
  "cierre",
]);
export type RutaComercial = z.infer<typeof RutaComercialSchema>;

export const CamposCapturadosSchema = z.object({
  nombre: z.string().nullish(),
  telefono: z.string().nullish(),
  tipoEvento: z.string().nullish(),
  fechaTentativa: z.unknown().nullish(),
  aforo: z.number().int().nullish(),
  sedeId: z.string().nullish(),
  sedeNombre: z.string().nullish(),
  presupuestoOrientativo: z.unknown().nullish(),
  intencionCotizar: z.boolean().nullish(),
  intencionVisita: z.boolean().nullish(),
  encajeEconomico: EncajeEconomicoSchema.nullish(),
  intencionNivel: IntencionNivelSchema.nullish(),
  rangoInversion: RangoInversionSchema.nullish(),
  aceptaPiso250k: z.boolean().nullish(),
  fechaEstado: FechaEstadoSchema.nullish(),
  rutaComercial: RutaComercialSchema.nullish(),
  consentimientoSeguimiento: z.boolean().nullish(),
  numeroAclaracionesPiso: z.number().int().min(0).max(1).nullish(),
  numeroMensajesCaptura: z.number().int().min(0).nullish(),
  fechaTipo: FechaTipoSchema.nullish(),
  ventanaVisita: z.string().nullish(),
  aforoBanda: AforoBandaSchema.nullish(),
  origenZona: z.string().nullish(),
  email: z.string().nullish(),
  pdfEnviado: z.boolean().nullish(),
  adjuntoReintentos: z.number().int().min(0).nullish(),
  ctaGuion: z.enum(["visita", "ejecutivo", "fuera_presupuesto"]).nullish(),
});
export type CamposCapturados = z.infer<typeof CamposCapturadosSchema>;

export const IntentClasificadoSchema = z.enum([
  "guion_captura",
  "solicitud_humana",
  "datos_duros",
  "pregunta_documental",
  "ambiguo",
]);
export type IntentClasificado = z.infer<typeof IntentClasificadoSchema>;

export const REASONING_LEVELS = [
  "preflight",
  "intent",
  "routing",
  "gate_precio",
  "guion",
  "catalog_tools",
  "rag",
  "handoff",
  "outcome",
] as const;

export type ReasoningLevel = (typeof REASONING_LEVELS)[number];

export interface ReasoningStepBase {
  seq: number;
  at: string;
}

export type ReasoningStep = ReasoningStepBase &
  (
    | {
        level: "preflight";
        kind: "idempotencia" | "cupo" | "estado_bot";
        detail: Record<string, unknown>;
      }
    | {
        level: "intent";
        value: IntentClasificado;
        signals?: string[];
      }
    | {
        level: "routing";
        decision: { kind: string; motivo?: string };
        inputs: {
          capturaPendiente: boolean;
          adjuntoInvalido: boolean;
          hardQuota: boolean;
          pasoGuion?: PasoGuion | string;
          perfilListo?: boolean;
          pedidoCotizacion?: boolean | null;
          pedidoCotizacionFuente?: string | null;
          recotizarPorSlots?: boolean;
        };
      }
    | {
        level: "gate_precio";
        action: string;
        rama?: string;
        detail?: Record<string, unknown>;
      }
    | {
        level: "guion";
        pasoFrom: PasoGuion | string;
        pasoTo: PasoGuion | string;
        camposDelta?: string[];
      }
    | {
        level: "catalog_tools";
        tools: Array<{
          nombre: string;
          ok: boolean;
          filasSku: string[];
          errorCode?: string;
        }>;
        antiHallucination?: "pass" | "strip_handoff";
      }
    | {
        level: "rag";
        scoresRerank: number[];
        umbral: number;
        fragmentoIds: string[];
        cita?: string | null;
        registroRecuperacionId?: string;
        motivoHandoff?: string | null;
      }
    | {
        level: "handoff";
        motivo: string;
      }
    | {
        level: "outcome";
        ruta: RutaOrquestador | string;
        estadoBot: EstadoBot | string;
        motivoHandoff: string | null;
        eventoOperativoId?: string | null;
        registroConsultaCatalogoId?: string | null;
        registroRecuperacionId?: string | null;
      }
  );

export interface ReasoningTraceOutcome {
  ruta: RutaOrquestador | string;
  estadoBot?: EstadoBot | string;
  motivoHandoff: string | null;
  eventoOperativoId: string | null;
  registroConsultaCatalogoId: string | null;
  registroRecuperacionId: string | null;
}

export type ReasoningTrace = {
  id: string;
  turnId: string;
  conversacionId: string;
  startedAt: string;
  finishedAt?: string;
  steps: ReasoningStep[];
  outcome?: ReasoningTraceOutcome;
};

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

export type ReasoningStepInput = DistributiveOmit<ReasoningStep, "seq" | "at">;
