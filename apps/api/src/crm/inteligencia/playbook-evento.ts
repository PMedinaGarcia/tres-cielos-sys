/**
 * Playbook comercial por rubro (tipo de evento) y derivación de inteligencia.
 * Cotización y visita son rieles paralelos.
 */
import type {
  EtapaCotizacion,
  EtapaPipeline,
  VisitaEstado,
} from "@tres-cielos/shared";

export const ESTANCAMIENTO_MS = 24 * 60 * 60 * 1000;

export type PlaybookPaso = {
  id: EtapaCotizacion;
  label: string;
};

const PLAYBOOK_BODA: PlaybookPaso[] = [
  { id: "perfilando", label: "Perfilado" },
  { id: "explorando", label: "Explorar catálogo" },
  { id: "listo_para_cotizar", label: "Listo para cotizar" },
  { id: "propuesta_enviada", label: "Propuesta enviada" },
];

const PLAYBOOK_SIN_TARIFA: PlaybookPaso[] = [
  { id: "perfilando", label: "Perfilado" },
  { id: "sin_tarifa", label: "Sin tarifa publicada" },
  { id: "propuesta_enviada", label: "Propuesta a medida" },
];

export function tieneTarifaPublicada(tipoEvento: string | null | undefined): boolean {
  return tipoEvento === "boda";
}

export function playbookCotizacion(tipoEvento: string | null | undefined): PlaybookPaso[] {
  return tieneTarifaPublicada(tipoEvento) ? PLAYBOOK_BODA : PLAYBOOK_SIN_TARIFA;
}

export type InteligenciaInput = {
  tipoEvento: string | null;
  calificacion: string;
  listoParaCotizar: boolean;
  paqueteTentativoId: string | null;
  etapa: string;
  propuestaEnviadaEn: Date | string | null;
  visitaEstado: VisitaEstado | string;
  intencionVisita: boolean;
  motivoHandoff?: string | null;
  ultimaRuta?: string | null;
  pasoGuion?: string | null;
  perfilCompleto?: boolean;
  intencionCotizar?: boolean | null;
  ultimoContactoEn: Date | string;
  estadoAtencion?: string | null;
  now?: Date;
};

export type InteligenciaComercial = {
  etapaCotizacion: EtapaCotizacion;
  visitaEstado: VisitaEstado;
  estancado: boolean;
  siguienteAccion: string;
  playbook: PlaybookPaso[];
};

const TERMINAL_PIPELINE = new Set(["ganado", "perdido"]);
const PROTEGIDAS_PIPELINE = new Set([
  "contactado",
  "propuesta",
  "negociacion",
  "ganado",
  "perdido",
]);

export function perfilDesdeOportunidad(input: {
  tipoEvento: string | null;
  fechaTentativa: Date | string | null;
  aforo: number | null;
  sede: string | null;
}): boolean {
  return Boolean(
    input.tipoEvento &&
      input.fechaTentativa &&
      input.aforo != null &&
      input.sede,
  );
}

export function nextEtapaPipeline(
  actual: EtapaPipeline | string | undefined,
  calificado: boolean,
): EtapaPipeline {
  const current = (actual ?? "nuevo_bot") as EtapaPipeline;
  if (PROTEGIDAS_PIPELINE.has(current)) return current;
  if (calificado && current === "nuevo_bot") return "calificado";
  return current;
}

export function derivarInteligencia(input: InteligenciaInput): InteligenciaComercial {
  const now = input.now ?? new Date();
  const ultimo =
    input.ultimoContactoEn instanceof Date
      ? input.ultimoContactoEn
      : new Date(input.ultimoContactoEn);
  const visitaEstado = (input.visitaEstado || "no_solicitada") as VisitaEstado;
  const etapa = input.etapa as EtapaPipeline;
  const etapaCotizacion = derivarEtapaCotizacion(input, etapa);
  const terminal =
    TERMINAL_PIPELINE.has(etapa) ||
    etapaCotizacion === "ganado" ||
    etapaCotizacion === "perdido" ||
    input.estadoAtencion === "cerrado";
  const estancado =
    !terminal && now.getTime() - ultimo.getTime() > ESTANCAMIENTO_MS;

  return {
    etapaCotizacion,
    visitaEstado,
    estancado,
    siguienteAccion: siguienteAccionDe({
      etapaCotizacion,
      visitaEstado,
      estancado,
      estadoAtencion: input.estadoAtencion ?? null,
    }),
    playbook: playbookCotizacion(input.tipoEvento),
  };
}

function derivarEtapaCotizacion(
  input: InteligenciaInput,
  etapa: EtapaPipeline,
): EtapaCotizacion {
  if (etapa === "ganado") return "ganado";
  if (etapa === "perdido") return "perdido";
  if (etapa === "negociacion") return "negociacion";
  if (input.propuestaEnviadaEn || etapa === "propuesta") return "propuesta_enviada";
  if (input.listoParaCotizar) return "listo_para_cotizar";

  const catalogo = tieneTarifaPublicada(input.tipoEvento);
  const sinTarifaSenal =
    input.motivoHandoff === "sin_catalogo" ||
    input.calificacion === "calificado" ||
    input.intencionCotizar === true ||
    (input.perfilCompleto &&
      (input.pasoGuion === "faq_libre" || input.pasoGuion === "intencion"));

  if (!catalogo && input.tipoEvento && sinTarifaSenal) {
    return "sin_tarifa";
  }

  if (
    catalogo &&
    (input.ultimaRuta === "catalogo" || input.pasoGuion === "faq_libre")
  ) {
    return "explorando";
  }

  if (input.perfilCompleto === false || !input.tipoEvento) {
    return "perfilando";
  }

  if (!catalogo) return "sin_tarifa";
  return "explorando";
}

function siguienteAccionDe(input: {
  etapaCotizacion: EtapaCotizacion;
  visitaEstado: VisitaEstado;
  estancado: boolean;
  estadoAtencion: string | null;
}): string {
  if (input.visitaEstado === "solicitada") return "Agendar visita";
  if (input.etapaCotizacion === "listo_para_cotizar") return "Enviar propuesta";
  if (input.etapaCotizacion === "sin_tarifa") return "Cotizar a medida";
  if (input.estadoAtencion === "escalado") return "Contactar (escalado)";
  if (input.estancado) return "Recontactar";
  if (input.etapaCotizacion === "perfilando") return "Completar brief";
  if (input.etapaCotizacion === "explorando") return "Seguir calificación";
  if (input.etapaCotizacion === "propuesta_enviada") return "Seguimiento de propuesta";
  if (input.etapaCotizacion === "negociacion") return "Cerrar negociación";
  if (input.etapaCotizacion === "ganado" || input.etapaCotizacion === "perdido") {
    return "Cerrado";
  }
  return "Seguimiento";
}
