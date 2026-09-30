import {
  applyDefaultBoda,
  b2PreguntaV3,
  nextPasoGuionV3,
  syncCamposV3,
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
  COPY_V2_B3,
  COPY_V3_B2_RANGO,
  COPY_V3_B2_RANGO_SIN_NOMBRE,
  copyB2Aforo,
} from "./script-v2.copy";
import type { ScriptV2TurnResult } from "./script-v2";

export function handleTurnV3(
  conv: ConversacionState,
  harvest: ReturnType<typeof harvestCamposLexical>,
  filled: HarvestFilledKey[],
): ScriptV2TurnResult {
  let campos = applyDefaultBoda(syncCamposV3(harvest.campos));
  if (campos.aforo != null) assignSedeUnica(campos);

  const focused = conv.pasoGuion;
  const focusedError = focusedSlotErrorV3(focused, campos, harvest);
  if (focusedError) {
    return bumpCaptura(focusedError, conv, filled);
  }

  const next = nextPasoGuionV3(campos);
  if (next === "faq_libre" || next === "accion") {
    return replyV3("", next, campos, true);
  }

  const copy = composeCopyV3(campos, filled, next, conv.pasoGuion, harvest);
  const aclarando = next === "aclaracion_piso";
  return bumpCaptura(
    replyV3(copy, next, {
      ...campos,
      numeroAclaracionesPiso: aclarando
        ? Math.max(campos.numeroAclaracionesPiso ?? 0, 1)
        : campos.numeroAclaracionesPiso,
    }),
    conv,
    filled,
  );
}

function composeCopyV3(
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
    return copyB2V3(campos);
  }
  if (next === "aclaracion_piso") return COPY_V2_B3;
  return COPY_V2_B1;
}

function copyB2V3(campos: CamposCapturados, retry = false): string {
  if (b2PreguntaV3(campos) === "aforo") {
    return copyB2Aforo(campos, retry);
  }
  return campos.nombre
    ? COPY_V3_B2_RANGO(campos.nombre)
    : COPY_V3_B2_RANGO_SIN_NOMBRE;
}

function focusedSlotErrorV3(
  focused: PasoGuion,
  campos: CamposCapturados,
  harvest: ReturnType<typeof harvestCamposLexical>,
): ScriptV2TurnResult | null {
  if (focused === "nombre_fecha") {
    if (gapNombreFecha(campos) !== "completo") {
      return replyV3(copyNombreFecha(campos, harvest), "nombre_fecha", campos);
    }
  }
  if (focused === "aforo_inversion") {
    const cual = b2PreguntaV3(campos);
    if (cual) {
      return replyV3(
        copyB2V3(campos, cual === "aforo"),
        "aforo_inversion",
        campos,
      );
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

function replyV3(
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
