import {
  GUION_ADJUNTO_PAQUETE_BODAS,
  type GuionAdjuntoId,
} from "@tres-cielos/shared";
import type { CamposCapturados, ConversacionState, PasoGuion } from "../types";
import type { ScriptV2TurnResult } from "./script-v2";
import {
  COPY_V4_CTA_RETRY,
  COPY_V4_PDF,
  COPY_V4_PRESUPUESTO_FUERA,
  COPY_V4_PRESUPUESTO_FUERA_RETRY,
} from "./script-v4.copy";

export type ScriptPaqueteTurnResult = ScriptV2TurnResult & {
  adjuntoGuion?: GuionAdjuntoId;
};

/** Tras nombre + fecha: PDF, galería y CTAs (sin aforo). */
export function nextPasoGuionPaqueteComercial(
  campos: CamposCapturados,
): PasoGuion {
  if (!campos.nombre || !campos.fechaTentativa) return "nombre_fecha";
  if (!campos.pdfEnviado || !campos.ctaGuion) return "accion";
  if (
    campos.ctaGuion === "fuera_presupuesto" &&
    !campos.rangoPresupuestoFuera
  ) {
    return "presupuesto_fuera";
  }
  return "faq_libre";
}

export function composePaqueteComercialTurn(
  conv: ConversacionState,
  campos: CamposCapturados,
  next: PasoGuion,
): ScriptPaqueteTurnResult | null {
  if (next === "faq_libre") {
    return replyPaquete("", next, campos, true);
  }
  if (next === "presupuesto_fuera") {
    const repetido = conv.pasoGuion === "presupuesto_fuera";
    return replyPaquete(
      repetido ? COPY_V4_PRESUPUESTO_FUERA_RETRY : COPY_V4_PRESUPUESTO_FUERA,
      next,
      campos,
    );
  }
  if (next !== "accion") return null;
  if (campos.pdfEnviado) {
    return replyPaquete(COPY_V4_CTA_RETRY, "accion", campos);
  }
  return {
    ...replyPaquete(COPY_V4_PDF(campos.nombre!), "accion", campos),
    adjuntoGuion: GUION_ADJUNTO_PAQUETE_BODAS,
  };
}

function replyPaquete(
  textoRespuesta: string,
  pasoGuion: PasoGuion,
  camposCapturados: CamposCapturados,
  guionCompleto = false,
): ScriptPaqueteTurnResult {
  return {
    textoRespuesta,
    pasoGuion,
    camposCapturados,
    avanzado: true,
    guionCompleto,
  };
}
