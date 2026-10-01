import {
  GUION_ADJUNTO_PAQUETE_BODAS,
  type GuionAdjuntoId,
} from "@tres-cielos/shared";
import {
  applyDefaultBoda,
  fechaEstadoFrom,
  nextPasoGuionV4,
} from "../conversation-flow";
import type {
  CamposCapturados,
  ConversacionState,
  PasoGuion,
} from "../types";
import type { harvestCamposLexical } from "./harvest-campos";
import type { ScriptV2TurnResult } from "./script-v2";
import {
  COPY_V4_B1,
  COPY_V4_B1_RETRY,
  COPY_V4_CTA_RETRY,
  COPY_V4_NOMBRE,
  COPY_V4_NOMBRE_RETRY,
  COPY_V4_PDF,
  COPY_V4_PRESUPUESTO_FUERA,
  COPY_V4_PRESUPUESTO_FUERA_RETRY,
} from "./script-v4.copy";

export interface ScriptV4TurnResult extends ScriptV2TurnResult {
  adjuntoGuion?: GuionAdjuntoId;
}

export function handleTurnV4(
  conv: ConversacionState,
  harvest: ReturnType<typeof harvestCamposLexical>,
): ScriptV4TurnResult {
  const campos = applyDefaultBoda(harvest.campos);
  campos.fechaEstado = fechaEstadoFrom(campos);

  const next = nextPasoGuionV4(campos);
  if (next === "faq_libre") {
    return replyV4("", next, campos, true);
  }

  const repetido = next === conv.pasoGuion;
  const prev = conv.camposCapturados.numeroMensajesCaptura ?? 0;
  campos.numeroMensajesCaptura = repetido ? prev + 1 : 0;

  if (next === "fecha_ventana") {
    return replyV4(prev > 0 ? COPY_V4_B1_RETRY : COPY_V4_B1, next, campos);
  }
  if (next === "nombre") {
    return replyV4(repetido ? COPY_V4_NOMBRE_RETRY : COPY_V4_NOMBRE, next, campos);
  }
  if (next === "presupuesto_fuera") {
    return replyV4(
      repetido ? COPY_V4_PRESUPUESTO_FUERA_RETRY : COPY_V4_PRESUPUESTO_FUERA,
      next,
      campos,
    );
  }
  if (repetido || campos.pdfEnviado) {
    return replyV4(COPY_V4_CTA_RETRY, next, campos);
  }
  return {
    ...replyV4(COPY_V4_PDF(campos.nombre!), next, campos),
    adjuntoGuion: GUION_ADJUNTO_PAQUETE_BODAS,
  };
}

function replyV4(
  textoRespuesta: string,
  pasoGuion: PasoGuion,
  camposCapturados: CamposCapturados,
  guionCompleto = false,
): ScriptV4TurnResult {
  return {
    textoRespuesta,
    pasoGuion,
    camposCapturados,
    avanzado: true,
    guionCompleto,
  };
}
