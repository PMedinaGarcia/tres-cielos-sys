/**
 * Vista del estado persistido del guion. No re-ejecuta el routing del orquestador:
 * lee CTA, ruta, fecha y presupuesto ya guardados y los dice con el lenguaje del bot.
 */
import type { EtapaCotizacion } from "@tres-cielos/shared";
import {
  CTA_GUION_LABEL,
  FECHA_ESTADO_LABEL,
  labelPresupuestoBrief,
  PASO_GUION_LABEL,
  RUTA_COMERCIAL_LABEL,
  VISITA_ESTADO_LABEL,
  type CtaGuion,
  type ResumenComercialBot,
  type ResumenComercialCaptura,
  type RutaComercial,
} from "@tres-cielos/shared";
import { labelFechaEventoBrief } from "../../conversation/script/harvest-campos";
import type { FechaEstado, FechaTentativa } from "../../conversation/types";

export type ResumenComercialInput = {
  etapa: string;
  etapaCotizacion: EtapaCotizacion;
  listoParaCotizar: boolean;
  visitaEstado: string;
  intencionVisita: boolean;
  propuestaEnviadaEn: Date | string | null;
  pasoGuion?: string | null;
  estadoBot?: string | null;
  estadoAtencion?: string | null;
  cola?: string | null;
  rutaComercial?: string | null;
  encajeEconomico?: string | null;
  fechaColumna?: Date | string | null;
  campos: {
    fechaTentativa?: unknown;
    fechaEstado?: string | null;
    rangoInversion?: string | null;
    rangoPresupuestoFuera?: string | null;
    ctaGuion?: string | null;
    rutaComercial?: string | null;
    encajeEconomico?: string | null;
    pdfEnviado?: boolean | null;
    intencionVisita?: boolean | null;
  };
};

type Relato = { titulo: string; siguienteParaAsesor: string };

export function derivarResumenComercialBot(
  input: ResumenComercialInput,
): ResumenComercialBot {
  const cta = asCta(input.campos.ctaGuion);
  const ruta = asRuta(input.campos.rutaComercial ?? input.rutaComercial);
  const encaje = input.campos.encajeEconomico ?? input.encajeEconomico ?? null;
  const presupuesto = labelPresupuestoBrief({
    rangoInversion: input.campos.rangoInversion,
    rangoPresupuestoFuera: input.campos.rangoPresupuestoFuera,
  });
  const relato = relatoDe({
    ...input,
    cta,
    ruta,
    encaje,
    presupuesto,
  });
  const pasoLabel = input.pasoGuion
    ? (PASO_GUION_LABEL[input.pasoGuion] ?? null)
    : null;
  const capturas = [
    capturaFecha(input),
    capturaPresupuesto(input, presupuesto),
    capturaAccion(input, cta, ruta),
  ];
  return {
    titulo: relato.titulo,
    subtitulo: pasoLabel && pasoLabel !== relato.titulo ? pasoLabel : null,
    capturas,
    siguienteParaAsesor: ajustarSiguienteVisita(input, cta, ruta, relato.siguienteParaAsesor),
  };
}

function relatoDe(
  input: ResumenComercialInput & {
    cta: CtaGuion | null;
    ruta: RutaComercial | null;
    encaje: string | null;
    presupuesto: string | null;
  },
): Relato {
  const escalado =
    input.estadoBot === "escalado" || input.estadoAtencion === "escalado";
  const pidioVisita =
    input.cta === "visita" ||
    input.intencionVisita ||
    input.campos.intencionVisita === true;
  const cerrado =
    input.etapa === "ganado" ||
    input.etapa === "perdido" ||
    input.etapaCotizacion === "ganado" ||
    input.etapaCotizacion === "perdido";

  if (input.etapa === "ganado" || input.etapaCotizacion === "ganado") {
    return { titulo: "Ganado", siguienteParaAsesor: "Cerrado" };
  }
  if (input.etapa === "perdido" || input.etapaCotizacion === "perdido") {
    return { titulo: "Perdido", siguienteParaAsesor: "Cerrado" };
  }
  if (input.etapa === "negociacion" || input.etapaCotizacion === "negociacion") {
    return {
      titulo: "Negociaci\u00f3n",
      siguienteParaAsesor: "Cerrar negociaci\u00f3n",
    };
  }
  if (
    input.propuestaEnviadaEn ||
    input.etapa === "propuesta" ||
    input.etapaCotizacion === "propuesta_enviada"
  ) {
    const visita = visitaEtiqueta(input.visitaEstado);
    return {
      titulo: visita ? `Propuesta enviada \u00b7 ${visita}` : "Propuesta enviada",
      siguienteParaAsesor:
        input.visitaEstado === "solicitada"
          ? "Agendar visita"
          : "Seguimiento de propuesta",
    };
  }

  if (escalado && pidioVisita && input.cta !== "ejecutivo" && input.cta !== "fuera_presupuesto") {
    return {
      titulo: "Pidi\u00f3 agendar visita",
      siguienteParaAsesor: "Agendar visita",
    };
  }
  if (
    (input.ruta === "atencion_general" || input.cola === "atencion_general") &&
    input.cta !== "visita" &&
    input.cta !== "ejecutivo"
  ) {
    return {
      titulo: "Atenci\u00f3n general",
      siguienteParaAsesor: "Contactar (atenci\u00f3n general)",
    };
  }
  if (input.cta === "ejecutivo" || input.ruta === "handoff") {
    return {
      titulo: "Pidi\u00f3 hablar con ejecutivo",
      siguienteParaAsesor: "Contactar (ejecutivo)",
    };
  }
  if (escalado) {
    return {
      titulo: "Escalado \u2014 contactar",
      siguienteParaAsesor: "Contactar (escalado)",
    };
  }

  const fueraDePiso =
    input.ruta === "nutricion" ||
    (input.cta === "fuera_presupuesto" && Boolean(input.presupuesto)) ||
    (input.encaje === "no" && Boolean(input.presupuesto));
  if (fueraDePiso) {
    return {
      titulo: input.presupuesto
        ? `Fuera de presupuesto (${input.presupuesto})`
        : "Fuera de presupuesto",
      siguienteParaAsesor: "Dar seguimiento (nutrici\u00f3n)",
    };
  }
  if (input.ruta === "seguimiento") {
    return {
      titulo: "Seguimiento (intenci\u00f3n baja)",
      siguienteParaAsesor: "Dar seguimiento",
    };
  }
  if (input.cta === "visita" || (pidioVisita && input.visitaEstado === "solicitada" && !input.listoParaCotizar)) {
    return {
      titulo: "Pidi\u00f3 agendar visita",
      siguienteParaAsesor: "Agendar visita",
    };
  }
  if (input.cta === "fuera_presupuesto" || input.pasoGuion === "presupuesto_fuera") {
    return {
      titulo: "Fuera de presupuesto",
      siguienteParaAsesor: "Esperar rango de presupuesto",
    };
  }
  if (input.listoParaCotizar || input.etapaCotizacion === "listo_para_cotizar") {
    return {
      titulo: input.presupuesto
        ? `Listo para cotizar \u2014 ${input.presupuesto}`
        : "Listo para cotizar",
      siguienteParaAsesor: "Enviar propuesta",
    };
  }
  if (input.etapaCotizacion === "sin_tarifa") {
    return { titulo: "Sin tarifa publicada", siguienteParaAsesor: "Cotizar a medida" };
  }
  if (input.etapaCotizacion === "explorando") {
    return {
      titulo: "Explorando cat\u00e1logo",
      siguienteParaAsesor: "Seguir calificaci\u00f3n",
    };
  }
  if (input.ruta === "cierre") {
    return { titulo: "Cierre", siguienteParaAsesor: "Cerrado" };
  }

  const pdfSinCta = Boolean(input.campos.pdfEnviado) && !input.cta;
  if (pdfSinCta) {
    return {
      titulo: "Elige c\u00f3mo seguir",
      siguienteParaAsesor:
        "Esperar elecci\u00f3n: visita, ejecutivo o presupuesto",
    };
  }

  if (input.pasoGuion === "fecha_ventana") {
    return { titulo: "Ventana de fecha", siguienteParaAsesor: "Esperar fecha" };
  }
  if (input.pasoGuion === "aclaracion_piso") {
    return {
      titulo: "Piso de inversi\u00f3n",
      siguienteParaAsesor: "Confirmar piso de 250 mil",
    };
  }
  if (input.pasoGuion && PASO_GUION_LABEL[input.pasoGuion]) {
    return {
      titulo: PASO_GUION_LABEL[input.pasoGuion]!,
      siguienteParaAsesor: "Completar datos del evento",
    };
  }
  if (cerrado) {
    return { titulo: "Cerrado", siguienteParaAsesor: "Cerrado" };
  }
  return { titulo: "Perfilando", siguienteParaAsesor: "Completar datos del evento" };
}

function ajustarSiguienteVisita(
  input: ResumenComercialInput,
  cta: CtaGuion | null,
  ruta: RutaComercial | null,
  siguiente: string,
): string {
  if (
    input.visitaEstado === "solicitada" &&
    input.etapa !== "ganado" &&
    input.etapa !== "perdido" &&
    ruta !== "nutricion" &&
    cta !== "fuera_presupuesto"
  ) {
    return "Agendar visita";
  }
  return siguiente;
}

function capturaFecha(input: ResumenComercialInput): ResumenComercialCaptura {
  const fechaEstado = asFechaEstado(input.campos.fechaEstado);
  const humana = labelFechaEventoBrief({
    fechaTentativa: asFechaTentativa(input.campos.fechaTentativa),
    fechaEstado,
  });
  const cerrado = esCerrado(input);
  if (humana && fechaEstado !== "sin_definir") {
    return { id: "fecha", etiqueta: "Fecha", valor: humana, estado: "ok" };
  }
  if (fechaEstado === "sin_definir") {
    return {
      id: "fecha",
      etiqueta: "Fecha",
      valor: FECHA_ESTADO_LABEL.sin_definir,
      estado: "pendiente",
    };
  }
  if (input.fechaColumna) {
    const d = new Date(input.fechaColumna);
    if (!Number.isNaN(d.getTime())) {
      return {
        id: "fecha",
        etiqueta: "Fecha",
        valor: d.toLocaleDateString("es-MX", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
        estado: "ok",
      };
    }
  }
  return {
    id: "fecha",
    etiqueta: "Fecha",
    valor: null,
    estado: cerrado ? "na" : "pendiente",
  };
}

function capturaPresupuesto(
  input: ResumenComercialInput,
  presupuesto: string | null,
): ResumenComercialCaptura {
  if (presupuesto) {
    return {
      id: "presupuesto",
      etiqueta: "Presupuesto",
      valor: presupuesto,
      estado: "ok",
    };
  }
  return {
    id: "presupuesto",
    etiqueta: "Presupuesto",
    valor: null,
    estado: esCerrado(input) ? "na" : "pendiente",
  };
}

function capturaAccion(
  input: ResumenComercialInput,
  cta: CtaGuion | null,
  ruta: RutaComercial | null,
): ResumenComercialCaptura {
  if (esCerrado(input)) {
    return {
      id: "accion",
      etiqueta: "Acci\u00f3n siguiente",
      valor: "Cerrado",
      estado: "na",
    };
  }
  if (cta) {
    return {
      id: "accion",
      etiqueta: "Acci\u00f3n siguiente",
      valor: CTA_GUION_LABEL[cta],
      estado: "ok",
    };
  }
  const visita = visitaEtiqueta(input.visitaEstado);
  if (visita) {
    return { id: "accion", etiqueta: "Acción siguiente", valor: visita, estado: "ok" };
  }
  if (ruta) {
    return {
      id: "accion",
      etiqueta: "Acci\u00f3n siguiente",
      valor: RUTA_COMERCIAL_LABEL[ruta],
      estado: "ok",
    };
  }
  if (input.campos.pdfEnviado) {
    return {
      id: "accion",
      etiqueta: "Acci\u00f3n siguiente",
      valor: "Elige c\u00f3mo seguir",
      estado: "pendiente",
    };
  }
  return {
    id: "accion",
    etiqueta: "Acción siguiente",
    valor: null,
    estado: "pendiente",
  };
}

function visitaEtiqueta(estado: string): string | null {
  if (estado === "no_solicitada" || !(estado in VISITA_ESTADO_LABEL)) return null;
  return VISITA_ESTADO_LABEL[estado as keyof typeof VISITA_ESTADO_LABEL];
}

function esCerrado(input: ResumenComercialInput): boolean {
  return (
    input.etapa === "ganado" ||
    input.etapa === "perdido" ||
    input.etapaCotizacion === "ganado" ||
    input.etapaCotizacion === "perdido"
  );
}

function asCta(value: string | null | undefined): CtaGuion | null {
  if (value === "visita" || value === "ejecutivo" || value === "fuera_presupuesto") {
    return value;
  }
  return null;
}

function asRuta(value: string | null | undefined): RutaComercial | null {
  if (
    value === "handoff" ||
    value === "atencion_general" ||
    value === "seguimiento" ||
    value === "nutricion" ||
    value === "cierre"
  ) {
    return value;
  }
  return null;
}

function asFechaEstado(value: string | null | undefined): FechaEstado | null {
  if (
    value === "definida" ||
    value === "ventana" ||
    value === "tentativa" ||
    value === "sin_definir"
  ) {
    return value;
  }
  return null;
}

function asFechaTentativa(value: unknown): FechaTentativa | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const tipo = (value as { tipo?: unknown }).tipo;
  if (tipo !== "dia" && tipo !== "rango" && tipo !== "mes") return null;
  return value as FechaTentativa;
}
