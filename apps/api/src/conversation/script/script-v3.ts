import {
  applyDefaultBoda,
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
import { COPY_V2_B1, COPY_V2_B3 } from "./script-v2.copy";
import type { ScriptV2TurnResult } from "./script-v2";
import { composePaqueteComercialTurn } from "./script-paquete-comercial";

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
  const paquete = composePaqueteComercialTurn(conv, campos, next);
  if (paquete) return bumpCaptura(paquete, conv, filled);

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
  if (next === "aclaracion_piso") return COPY_V2_B3;
  return COPY_V2_B1;
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
