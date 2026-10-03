import {
  anioTarifaPublicada,
  HABLAR_ASESOR_PAYLOAD,
  HABLAR_ASESOR_TITLE,
  HABLAR_ASESOR_TEXTO,
  type WaButton,
  type WaListItem,
} from "@tres-cielos/shared";

export const HABLAR_ASESOR_BUTTON: WaButton = {
  id: HABLAR_ASESOR_PAYLOAD,
  title: HABLAR_ASESOR_TITLE,
};

export const WA_LIST_OPEN_BUTTON = "Ver opciones";

export const OCASION_ITEMS: WaListItem[] = [
  { id: "ocasion.boda", title: "Boda", description: "Ceremonia y celebración" },
  { id: "ocasion.xv", title: "XV", description: "Fiesta de quince años" },
  { id: "ocasion.corporativo", title: "Corporativo", description: "Evento de empresa" },
  { id: "ocasion.social", title: "Social", description: "Reunión o evento social" },
  { id: "ocasion.otro", title: "Otro", description: "Otra ocasión" },
];

export const INTENCION_SI_BUTTON: WaButton = {
  id: "intencion.si",
  title: "Sí",
};

export const INTENCION_NO_BUTTON: WaButton = {
  id: "intencion.no",
  title: "No",
};

export const INVERSION_ITEMS: WaListItem[] = [
  {
    id: "inversion.r250_349",
    title: "$250–349 mil",
    description: "Punto de partida",
  },
  {
    id: "inversion.r350_499",
    title: "$350–499 mil",
    description: "Producción media",
  },
  {
    id: "inversion.r500_mas",
    title: "$500 mil o más",
    description: "Producción amplia",
  },
  {
    id: "inversion.por_definir",
    title: "Aún por definir",
    description: "Todavía no lo definimos",
  },
];

export const ACLARACION_SI_BUTTON: WaButton = {
  id: "aclaracion.si",
  title: "Sí, lo consideramos",
};

export const ACLARACION_NO_BUTTON: WaButton = {
  id: "aclaracion.no",
  title: "Buscamos algo menor",
};

const ANIO_TARIFA = anioTarifaPublicada();

export const FECHA_VENTANA_ITEMS: WaListItem[] = [
  {
    id: "fecha.ene_may",
    title: `Ene-May ${ANIO_TARIFA}`,
    description: "De enero a mayo",
  },
  {
    id: "fecha.jun_sep",
    title: `Jun-Sep ${ANIO_TARIFA}`,
    description: "De junio a septiembre",
  },
  {
    id: "fecha.oct_dic",
    title: `Oct-Dic ${ANIO_TARIFA}`,
    description: "De octubre a diciembre",
  },
  {
    id: "fecha.anio_2028",
    title: "2028",
    description: "Planeo en este año",
  },
];

export const ACCION_CTA_ITEMS: WaListItem[] = [
  {
    id: "accion.visita",
    title: "Conocer Tres Cielos",
    description: "Quiero conocer Tres Cielos.",
  },
  {
    id: "accion.ejecutivo",
    title: "Tengo dudas",
    description: "Tengo dudas, quiero hablar con un ejecutivo.",
  },
  {
    id: "accion.fuera_presupuesto",
    title: "Fuera de presupuesto",
    description: "Estamos fuera de tu presupuesto",
  },
];

export const PRESUPUESTO_FUERA_ITEMS: WaListItem[] = [
  {
    id: "presupuesto.r200_250",
    title: "200-250 mil",
    description: "Entre 200 y 250 mil",
  },
  {
    id: "presupuesto.r250_300",
    title: "250-300 mil",
    description: "Entre 250 y 300 mil",
  },
  {
    id: "presupuesto.fuera_rango",
    title: "Fuera de Rango",
    description: "Por debajo de 200 mil",
  },
];

/**
 * Texto canónico para extractores del guion cuando el inbound
 * llega como ButtonPayload / ListId de Twilio o del sandbox.
 */
export const WA_PAYLOAD_TEXTO: Record<string, string> = {
  [HABLAR_ASESOR_PAYLOAD]: HABLAR_ASESOR_TEXTO,
  "ocasion.boda": "boda",
  "ocasion.xv": "xv",
  "ocasion.corporativo": "corporativo",
  "ocasion.social": "social",
  "ocasion.otro": "otro",
  "sede.jardin_1": "Tres Cielos Tequesquitengo",
  "intencion.si": "sí",
  "intencion.no": "no",
  "inversion.r250_349": "$250-349 mil",
  "inversion.r350_499": "$350-499 mil",
  "inversion.r500_mas": "$500 mil o más",
  "inversion.por_definir": "aún por definir",
  "aclaracion.si": "sí",
  "aclaracion.no": "Buscamos algo menor",
  "fecha.ene_may": `Ene-May ${ANIO_TARIFA}`,
  "fecha.jun_sep": `Jun-Sep ${ANIO_TARIFA}`,
  "fecha.oct_dic": `Oct-Dic ${ANIO_TARIFA}`,
  "fecha.anio_2028": "2028",
  "accion.visita": "Conocer Tres Cielos",
  "accion.ejecutivo": "Tengo dudas",
  "accion.fuera_presupuesto": "Estamos fuera de tu presupuesto",
  "presupuesto.r200_250": "200-250 mil",
  "presupuesto.r250_300": "250-300 mil",
  "presupuesto.fuera_rango": "Fuera de Rango",
};

export function resolveInteractiveInbound(input: {
  texto: string;
  buttonPayload?: string | null;
}): { texto: string; buttonPayload?: string } {
  const payload = input.buttonPayload?.trim();
  if (!payload) {
    return { texto: input.texto };
  }
  const canonical = WA_PAYLOAD_TEXTO[payload];
  return {
    texto: canonical ?? input.texto,
    buttonPayload: payload,
  };
}

export function contentSidFor(templateId: string): string | undefined {
  const envKey = `TWILIO_CONTENT_SID_${templateId.replace(/\./g, "_").toUpperCase()}`;
  const value = process.env[envKey];
  return value && value.length > 0 ? value : undefined;
}
