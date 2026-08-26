import type { WaButton, WaContent, WaDocument } from "@tres-cielos/shared";
import {
  HABLAR_ASESOR_BUTTON,
  INTENCION_NO_BUTTON,
  INTENCION_SI_BUTTON,
  OCASION_ITEMS,
  WA_LIST_OPEN_BUTTON,
  contentSidFor,
} from "./wa-templates.catalog";

export function composeWaContent(input: {
  texto: string;
  ruta: string;
  pasoGuion?: string | null;
  document?: WaDocument;
}): WaContent | undefined {
  const body = input.texto.trim();
  if (!body || input.ruta === "silencio") return undefined;

  let content: WaContent | undefined;
  if (input.ruta === "handoff") {
    content = textTemplate("canal.handoff", body);
  } else if (input.ruta === "catalogo") {
    content = quickReply("canal.catalogo", body, [HABLAR_ASESOR_BUTTON]);
  } else if (input.ruta === "rag") {
    content = quickReply("canal.rag", body, [HABLAR_ASESOR_BUTTON]);
  } else if (input.ruta === "safe") {
    content = quickReply("canal.safe", body, [HABLAR_ASESOR_BUTTON]);
  } else {
    content = composeGuionPaso(body, input.pasoGuion);
  }

  if (!content) return undefined;
  if (input.document) {
    return { ...content, document: input.document };
  }
  return content;
}

function composeGuionPaso(
  body: string,
  pasoGuion?: string | null,
): WaContent {
  switch (pasoGuion) {
    case "ocasion":
      return {
        templateId: "guion.ocasion",
        kind: "list-picker",
        body,
        list: { button: WA_LIST_OPEN_BUTTON, items: OCASION_ITEMS },
        contentSid: contentSidFor("guion.ocasion"),
      };
    case "sede":
      return quickReply("guion.sede", body, [HABLAR_ASESOR_BUTTON]);
    case "intencion":
    case "presupuesto":
      return quickReply("guion.intencion", body, [
        INTENCION_SI_BUTTON,
        INTENCION_NO_BUTTON,
        HABLAR_ASESOR_BUTTON,
      ]);
    case "nombre":
    case "saludo":
      return quickReply("guion.nombre", body, [HABLAR_ASESOR_BUTTON]);
    case "fecha":
      return quickReply("guion.fecha", body, [HABLAR_ASESOR_BUTTON]);
    case "aforo":
      return quickReply("guion.aforo", body, [HABLAR_ASESOR_BUTTON]);
    case "faq_libre":
      return quickReply("guion.faq_libre", body, [HABLAR_ASESOR_BUTTON]);
    default:
      return quickReply("canal.generic", body, [HABLAR_ASESOR_BUTTON]);
  }
}

export function attachWaContent<
  T extends {
    textoRespuesta: string;
    ruta: string;
    silencio?: boolean;
    pasoGuion?: string;
    waContent?: WaContent | null;
    document?: WaDocument;
  },
>(result: T): Omit<T, "document"> {
  const { document, ...rest } = result;
  if (rest.waContent) return rest;
  if (rest.silencio || !rest.textoRespuesta) return rest;
  const waContent = composeWaContent({
    texto: rest.textoRespuesta,
    ruta: rest.ruta,
    pasoGuion: rest.pasoGuion,
    document,
  });
  if (!waContent) return rest;
  return { ...rest, waContent };
}

function textTemplate(templateId: string, body: string): WaContent {
  return {
    templateId,
    kind: "text",
    body,
    contentSid: contentSidFor(templateId),
  };
}

function quickReply(
  templateId: string,
  body: string,
  buttons: WaButton[],
): WaContent {
  return {
    templateId,
    kind: "quick-reply",
    body,
    buttons,
    contentSid: contentSidFor(templateId),
  };
}
