import {
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
  { id: HABLAR_ASESOR_PAYLOAD, title: HABLAR_ASESOR_TITLE, description: "Hablar con una persona" },
];

export const INTENCION_SI_BUTTON: WaButton = {
  id: "intencion.si",
  title: "Sí",
};

export const INTENCION_NO_BUTTON: WaButton = {
  id: "intencion.no",
  title: "No",
};

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
