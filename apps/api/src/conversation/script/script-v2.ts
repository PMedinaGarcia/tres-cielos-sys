import {
  applyDefaultBoda,
  b2PreguntaV3,
  nextPasoGuionV2,
  syncCamposV2,
} from "../conversation-flow";
import type {
  CamposCapturados,
  ConversacionState,
  PasoGuion,
} from "../types";
import {
  copyNombreFecha,
  gapNombreFecha,
  siguienteNumeroMensajesCaptura,
} from "./captura-progreso";
import {
  assignSedeUnica,
  harvestCamposLexical,
  type HarvestFilledKey,
} from "./harvest-campos";
import {
  COPY_V2_B1,
  COPY_V2_B2,
  COPY_V2_B2_SIN_NOMBRE,
  COPY_V2_B3,
  copyB2Aforo,
} from "./script-v2.copy";

export interface ScriptV2TurnResult {
  textoRespuesta: string;
  pasoGuion: PasoGuion;
  camposCapturados: CamposCapturados;
  avanzado: boolean;
  guionCompleto: boolean;
}

export function handleTurnV2(
  conv: ConversacionState,
  harvest: ReturnType<typeof harvestCamposLexical>,
  filled: HarvestFilledKey[],
): ScriptV2TurnResult {
  let campos = applyDefaultBoda(syncCamposV2(harvest.campos));
  if (campos.aforo != null) assignSedeUnica(campos);

  const focused = conv.pasoGuion;
  const focusedError = focusedSlotErrorV2(focused, campos, harvest);
  if (focusedError) {
    return bumpCaptura(focusedError, conv, filled);
  }

  const next = nextPasoGuionV2(campos);
  if (next === "faq_libre" || next === "accion") {
    return replyV2("", next, campos, true);
  }

  const copy = composeCopyV2(campos, filled, next, conv.pasoGuion, harvest);
  const aclarando = next === "aclaracion_piso";
  return bumpCaptura(
    replyV2(copy, next, {
      ...campos,
      numeroAclaracionesPiso: aclarando
        ? Math.max(campos.numeroAclaracionesPiso ?? 0, 1)
        : campos.numeroAclaracionesPiso,
    }),
    conv,
    filled,
  );
}

function composeCopyV2(
  campos: CamposCapturados,
  _filled: HarvestFilledKey[],
  next: PasoGuion,
  _from: PasoGuion,
  harvest: ReturnType<typeof harvestCamposLexical>,
): string {
  if (next === "nombre_fecha") {
    return copyNombreFecha(campos, harvest);
  }
  if (next === "aforo_inversion") {
    return copyB2V2(campos, false);
  }
  if (next === "aclaracion_piso") return COPY_V2_B3;
  return COPY_V2_B1;
}

function copyB2V2(campos: CamposCapturados, retry: boolean): string {
  if (b2PreguntaV3(campos) === "aforo") {
    return copyB2Aforo(campos, retry);
  }
  return campos.nombre ? COPY_V2_B2(campos.nombre) : COPY_V2_B2_SIN_NOMBRE;
}

function focusedSlotErrorV2(
  focused: PasoGuion,
  campos: CamposCapturados,
  harvest: ReturnType<typeof harvestCamposLexical>,
): ScriptV2TurnResult | null {
  if (focused === "nombre_fecha") {
    if (gapNombreFecha(campos) !== "completo") {
      return replyV2(copyNombreFecha(campos, harvest), "nombre_fecha", campos);
    }
  }
  if (focused === "aforo_inversion") {
    const cual = b2PreguntaV3(campos);
    if (cual) {
      return replyV2(copyB2V2(campos, cual === "aforo"), "aforo_inversion", campos);
    }
  }
  return null;
}

function bumpCaptura(
  result: ScriptV2TurnResult,
  conv: ConversacionState,
  filled: HarvestFilledKey[],
): ScriptV2TurnResult {
  if (!result.textoRespuesta) return result;
  const prev = conv.camposCapturados.numeroMensajesCaptura ?? 0;
  return {
    ...result,
    camposCapturados: {
      ...result.camposCapturados,
      numeroMensajesCaptura: siguienteNumeroMensajesCaptura(
        prev,
        filled,
        conv.camposCapturados,
      ),
    },
  };
}

function replyV2(
  textoRespuesta: string,
  pasoGuion: PasoGuion,
  camposCapturados: CamposCapturados,
  guionCompleto = false,
): ScriptV2TurnResult {
  return {
    textoRespuesta,
    pasoGuion,
    camposCapturados,
    avanzado: true,
    guionCompleto,
  };
}
