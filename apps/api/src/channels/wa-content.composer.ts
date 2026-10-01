import type {
  WaButton,
  WaContent,
  WaDocument,
  WaImage,
  WaListItem,
} from "@tres-cielos/shared";
import type { FechaTentativa } from "../conversation/types";
import {
  ACCION_CTA_ITEMS,
  PRESUPUESTO_FUERA_ITEMS,
  ACLARACION_NO_BUTTON,
  ACLARACION_SI_BUTTON,
  FECHA_VENTANA_ITEMS,
  INTENCION_NO_BUTTON,
  INTENCION_SI_BUTTON,
  INVERSION_ITEMS,
  OCASION_ITEMS,
  WA_LIST_OPEN_BUTTON,
  contentSidFor,
} from "./wa-templates.catalog";

export type AccionModo = "cta_v4" | "legacy";

export function composeWaContent(input: {
  texto: string;
  ruta: string;
  pasoGuion?: string | null;
  document?: WaDocument;
  aforo?: number | null;
  fechaTentativa?: FechaTentativa | null;
  accionModo?: AccionModo;
  images?: WaImage[];
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
    content = composeGuionPaso(
      body,
      input.pasoGuion,
      input.aforo,
      input.fechaTentativa,
      input.accionModo,
    );
  }

  if (!content) return undefined;
  let merged = content;
  if (input.document) merged = { ...merged, document: input.document };
  if (input.images?.length) merged = { ...merged, images: input.images };
  return merged;
}

function composeGuionPaso(
  body: string,
  pasoGuion?: string | null,
  aforo?: number | null,
  fechaTentativa?: FechaTentativa | null,
  accionModo?: AccionModo,
): WaContent {
  switch (pasoGuion) {
    case "fecha_ventana":
      return listPicker("guion.fecha_ventana", body, FECHA_VENTANA_ITEMS);
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
      if (!fechaTentativa) {
        return listPicker("guion.nombre_fecha", body, FECHA_VENTANA_ITEMS);
      }
      return textTemplate("guion.nombre_fecha", body);
    case "accion":
      return accionModo === "cta_v4"
        ? listPicker("guion.accion_cta", body, ACCION_CTA_ITEMS)
        : textTemplate("guion.accion", body);
    case "presupuesto_fuera":
      return listPicker(
        "guion.presupuesto_fuera",
        body,
        PRESUPUESTO_FUERA_ITEMS,
      );
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
    fechaTentativa?: FechaTentativa | null;
    accionModo?: AccionModo;
    images?: WaImage[];
  },
>(result: T): Omit<
  T,
  "document" | "aforo" | "fechaTentativa" | "accionModo" | "images"
> {
  const { document, aforo, fechaTentativa, accionModo, images, ...rest } = result;
  if (rest.waContent) return rest;
  if (rest.silencio || !rest.textoRespuesta) return rest;
  const waContent = composeWaContent({
    texto: rest.textoRespuesta,
    ruta: rest.ruta,
    pasoGuion: rest.pasoGuion,
    document,
    aforo,
    fechaTentativa,
    accionModo,
    images,
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

function listPicker(
  templateId: string,
  body: string,
  items: WaListItem[],
): WaContent {
  return {
    templateId,
    kind: "list-picker",
    body,
    list: { button: WA_LIST_OPEN_BUTTON, items },
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
