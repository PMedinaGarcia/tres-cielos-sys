import type { WaButton, WaContent, WaDocument } from "@tres-cielos/shared";
import {
  ACLARACION_NO_BUTTON,
  ACLARACION_SI_BUTTON,
  INTENCION_NO_BUTTON,
  INTENCION_SI_BUTTON,
  INVERSION_ITEMS,
  OCASION_ITEMS,
  WA_LIST_OPEN_BUTTON,
  contentSidFor,
} from "./wa-templates.catalog";

export function composeWaContent(input: {
  texto: string;
  ruta: string;
  pasoGuion?: string | null;
  document?: WaDocument;
  aforo?: number | null;
}): WaContent | undefined {
  const body = input.texto.trim();
  if (!body || input.ruta === "silencio") return undefined;

  let content: WaContent | undefined;
  if (input.ruta === "handoff") {
    content = textTemplate("canal.handoff", body);
  } else if (input.ruta === "catalogo") {
    content = textTemplate("canal.catalogo", body);
  } else if (input.ruta === "rag") {
    content = textTemplate("canal.rag", body);
  } else if (input.ruta === "safe") {
    content = textTemplate(
      input.pasoGuion === "faq_libre" ? "canal.nutricion" : "canal.safe",
      body,
    );
  } else {
    content = composeGuionPaso(body, input.pasoGuion, input.aforo);
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
  aforo?: number | null,
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
    case "aforo_inversion":
      if (aforo == null) {
        return textTemplate("guion.aforo", body);
      }
      return {
        templateId: "guion.aforo_inversion",
        kind: "list-picker",
        body,
        list: { button: WA_LIST_OPEN_BUTTON, items: INVERSION_ITEMS },
        contentSid: contentSidFor("guion.aforo_inversion"),
      };
    case "aclaracion_piso":
      return quickReply("guion.aclaracion_piso", body, [
        ACLARACION_SI_BUTTON,
        ACLARACION_NO_BUTTON,
      ]);
    case "nombre_fecha":
      return textTemplate("guion.nombre_fecha", body);
    case "accion":
      return textTemplate("guion.accion", body);
    case "sede":
      return textTemplate("guion.sede", body);
    case "intencion":
    case "presupuesto":
      return quickReply("guion.intencion", body, [
        INTENCION_SI_BUTTON,
        INTENCION_NO_BUTTON,
      ]);
    case "nombre":
    case "saludo":
      return textTemplate("guion.nombre", body);
    case "fecha":
      return textTemplate("guion.fecha", body);
    case "aforo":
      return textTemplate("guion.aforo", body);
    case "faq_libre":
      return textTemplate("guion.faq_libre", body);
    default:
      return textTemplate("canal.generic", body);
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
    aforo?: number | null;
  },
>(result: T): Omit<T, "document" | "aforo"> {
  const { document, aforo, ...rest } = result;
  if (rest.waContent) return rest;
  if (rest.silencio || !rest.textoRespuesta) return rest;
  const waContent = composeWaContent({
    texto: rest.textoRespuesta,
    ruta: rest.ruta,
    pasoGuion: rest.pasoGuion,
    document,
    aforo,
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
