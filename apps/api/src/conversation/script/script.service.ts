import { Inject, Injectable, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  GUION_ADJUNTO_PAQUETE_BODAS,
  anioTarifaPublicada,
  copySedeUbicacionCorta,
  ejemploFechaTarifaPublicada,
  type GuionAdjuntoId,
} from "@tres-cielos/shared";
import { isLiveAiProviders } from "../../config";
import {
  effectiveConversationFlow,
  isCapturaPendienteV2,
  isCapturaPendienteV3,
  isCapturaPendienteV4,
} from "../conversation-flow";
import { LLM_PORT } from "../../ports/tokens";
import type { LlmPort } from "../../ports/llm.port";
import type {
  CamposCapturados,
  ConversacionState,
  PasoGuion,
} from "../types";
import { extractScriptPasoWithLlm } from "./script-llm.extract";
import {
  assignSedeUnica,
  harvestCamposLexical,
  isGuionCompleto,
  mergeLlmExtract,
  nextPasoGuion,
  resumenCamposCapturados,
  shouldCallLlmHarvest,
  type HarvestFilledKey,
} from "./harvest-campos";
import { handleTurnV2 } from "./script-v2";
import { handleTurnV3 } from "./script-v3";
import { handleTurnV4 } from "./script-v4";

export type { AforoParseMotivo, AforoParseResult } from "./harvest-campos";

export interface ScriptTurnResult {
  textoRespuesta: string;
  pasoGuion: PasoGuion;
  camposCapturados: CamposCapturados;
  avanzado: boolean;
  guionCompleto: boolean;
  adjuntoGuion?: GuionAdjuntoId;
}

const { humana: EJEMPLO_FECHA, dmy: EJEMPLO_FECHA_DMY } =
  ejemploFechaTarifaPublicada();
const ANIO_TARIFA = anioTarifaPublicada();

const PREGUNTA_FECHA =
  `¿Qué fecha tentativa tienen? Necesito día, mes y año, por ejemplo ${EJEMPLO_FECHA} o ${EJEMPLO_FECHA_DMY}.`;

const PREGUNTA_OCASION = "¿Qué tipo de evento celebran?";

const PREGUNTA_INTENCION = "¿Desean cotizar o reservar con nosotros?";

const COPY_SEDE_E_INTENCION =
  `Nuestra sede es ${copySedeUbicacionCorta()}. Te compartimos la ficha de paquetes ${ANIO_TARIFA}. ${PREGUNTA_INTENCION}`;

const COPY_INTENCION_RETRY = "¿Confirman que desean cotizar?";

const COPY_FECHA_SIN_ANIO =
  `Necesito día, mes y año. Por ejemplo: ${EJEMPLO_FECHA}.`;

const COPY_FECHA_NO_INTERPRETADA =
  `No alcancé a interpretar la fecha. Indica día, mes y año, por ejemplo ${EJEMPLO_FECHA} o ${EJEMPLO_FECHA_DMY}.`;

const COPY_FECHA_PASADA =
  `Esa fecha ya pasó. Indica un día, mes y año vigentes, por ejemplo ${EJEMPLO_FECHA}.`;

const COPY_AFORO =
  "¿Cuántas personas aproximadamente asistirán? (número entero, por ejemplo 120 o 120 personas)";

const COPY_NOMBRE_RETRY = "Para continuar, ¿me indiques tu nombre?";

const COPY_SALUDO_NOMBRE =
  "¡Hola! Soy el asistente de Tres Cielos. ¿Me compartes tu nombre, por favor?";

const COPY_FAQ_LISTO =
  "¡Listo! Ya tengo lo esencial para calificarte. Puedes preguntarme por paquetes, precios o políticas del venue.";

const COPY_FAQ_SIN_COTIZAR =
  "Entendido. Si más adelante quieres cotizar, aquí estaré. ¿Tienes otra pregunta?";

const COPY_FAQ_LIBRE =
  "¿En qué más te puedo ayudar? Puedo consultar paquetes/precios del catálogo o políticas del venue.";

@Injectable()
export class ScriptService {
  constructor(
    @Optional() @Inject(LLM_PORT) private readonly llm?: LlmPort,
    @Optional() private readonly config?: ConfigService,
  ) {}

  /** ¿El turno debe quedar en captura de guion (sin RAG ni tools precio)? */
  isCapturaPendiente(conv: ConversacionState): boolean {
    const flow = effectiveConversationFlow(conv, this.config);
    if (flow === "v4") return isCapturaPendienteV4(conv);
    if (flow === "v3") return isCapturaPendienteV3(conv);
    if (flow === "v2") return isCapturaPendienteV2(conv);
    return conv.pasoGuion !== "faq_libre" && !this.isCompleto(conv.camposCapturados);
  }

  isCompleto(campos: CamposCapturados): boolean {
    return isGuionCompleto(campos);
  }

  async handleTurn(
    conv: ConversacionState,
    texto: string,
  ): Promise<ScriptTurnResult> {
    const focused: PasoGuion =
      conv.pasoGuion === "presupuesto" ? "intencion" : conv.pasoGuion;
    const trimmed = texto.trim();
    const aforoAntes = conv.camposCapturados.aforo;

    let harvest = harvestCamposLexical(trimmed, conv.camposCapturados, {
      focusedPaso: focused,
    });
    let campos = harvest.campos;
    const filled = [...harvest.filled];

    if (
      this.llm &&
      isLiveAiProviders(this.config) &&
      shouldCallLlmHarvest(trimmed, harvest, focused)
    ) {
      const llm = await this.llmExtract(focused, trimmed, campos);
      if (llm) {
        const merged = mergeLlmExtract(campos, llm, trimmed, {
          focusedPaso: focused,
        });
        campos = merged.campos;
        for (const key of merged.filled) {
          if (!filled.includes(key)) filled.push(key);
        }
        harvest = { ...harvest, campos };
      }
    }

    if (campos.aforo != null) assignSedeUnica(campos);

    const flow = effectiveConversationFlow(conv, this.config);
    if (flow === "v4") {
      return handleTurnV4(conv, { ...harvest, campos });
    }
    if (flow === "v3") {
      return handleTurnV3(conv, { ...harvest, campos }, filled);
    }
    if (flow === "v2") {
      return handleTurnV2(conv, { ...harvest, campos }, filled);
    }

    const focusedError = focusedSlotError(focused, campos, harvest);
    if (focusedError) return focusedError;

    if (focused === "sede") {
      assignSedeUnica(campos);
      if (campos.intencionCotizar == null) {
        return replySedeEIntencion(campos);
      }
    }

    const next = nextPasoGuion(campos);
    const aforoNuevo = aforoAntes == null && campos.aforo != null;

    if (next === "faq_libre") {
      if (campos.intencionCotizar === false) {
        return reply(COPY_FAQ_SIN_COTIZAR, "faq_libre", campos, false);
      }
      if (this.isCompleto(campos)) {
        return reply(
          COPY_FAQ_LISTO,
          "faq_libre",
          campos,
          true,
          aforoNuevo ? GUION_ADJUNTO_PAQUETE_BODAS : undefined,
        );
      }
      return reply(
        COPY_FAQ_LIBRE,
        "faq_libre",
        campos,
        this.isCompleto(campos),
      );
    }

    if (conv.pasoGuion === "saludo" && filled.length === 0) {
      if (campos.nombre) {
        return reply(
          `¡Hola ${campos.nombre}! Soy el asistente de Tres Cielos. ${preguntaParaPaso(next)}`,
          next,
          campos,
        );
      }
      return reply(COPY_SALUDO_NOMBRE, "nombre", campos);
    }

    if ((aforoNuevo || focused === "sede") && next === "intencion") {
      return replySedeEIntencion(campos);
    }

    const textoRespuesta = composeCapturaCopy(campos, filled, next);
    return reply(
      textoRespuesta,
      next,
      campos,
      false,
      aforoNuevo ? GUION_ADJUNTO_PAQUETE_BODAS : undefined,
    );
  }

  private async llmExtract(
    paso: PasoGuion,
    texto: string,
    campos: CamposCapturados,
  ) {
    if (!this.llm || !isLiveAiProviders(this.config)) return null;
    return extractScriptPasoWithLlm({
      llm: this.llm,
      texto,
      paso,
      campos,
    });
  }
}

function focusedSlotError(
  focused: PasoGuion,
  campos: CamposCapturados,
  harvest: ReturnType<typeof harvestCamposLexical>,
): ScriptTurnResult | null {
  if (focused === "fecha" && !campos.fechaTentativa) {
    if (harvest.fechaMotivo === "sin_anio") {
      return reply(COPY_FECHA_SIN_ANIO, "fecha", campos);
    }
    if (harvest.fechaMotivo === "pasada") {
      return reply(COPY_FECHA_PASADA, "fecha", campos);
    }
    return reply(COPY_FECHA_NO_INTERPRETADA, "fecha", campos);
  }
  if (focused === "aforo" && campos.aforo == null) {
    if (harvest.aforoMotivo === "unidad_invalida") {
      const shown = harvest.aforoFragmento ?? "el valor indicado";
      return reply(
        `No puedo procesar '${shown}'. Indica un número entero, por ejemplo 120 o 120 personas.`,
        "aforo",
        campos,
      );
    }
    if (harvest.aforoMotivo === "fuera_rango") {
      return reply("El aforo debe ser un entero entre 1 y 5000.", "aforo", campos);
    }
    return reply(
      "Necesito el aforo como número entero (por ejemplo 120 o 120 personas).",
      "aforo",
      campos,
    );
  }
  if (focused === "nombre" && !campos.nombre) {
    return reply(COPY_NOMBRE_RETRY, "nombre", campos);
  }
  if (focused === "ocasion" && !campos.tipoEvento) {
    return reply(PREGUNTA_OCASION, "ocasion", campos);
  }
  if (focused === "intencion" && campos.intencionCotizar == null) {
    return reply(COPY_INTENCION_RETRY, "intencion", campos);
  }
  return null;
}

function composeCapturaCopy(
  campos: CamposCapturados,
  filled: HarvestFilledKey[],
  next: PasoGuion,
): string {
  const pregunta = preguntaParaPaso(next);
  if (filled.includes("nombre") && campos.nombre && next === "ocasion") {
    return `Gracias, ${campos.nombre}. ${PREGUNTA_OCASION}`;
  }
  if (filled.length === 1 && filled[0] === "tipoEvento" && next === "fecha") {
    return `Perfecto. ${PREGUNTA_FECHA}`;
  }
  const eventFilled = filled.filter((k) =>
    k === "tipoEvento" || k === "fechaTentativa" || k === "aforo",
  );
  const resumen = resumenCamposCapturados(campos);
  if (
    resumen &&
    (eventFilled.length >= 2 ||
      (eventFilled.length >= 1 && (next === "nombre" || next === "intencion")))
  ) {
    return `Registré ${resumen}. ${pregunta}`;
  }
  if (filled.includes("nombre") && campos.nombre) {
    return `Gracias, ${campos.nombre}. ${pregunta}`;
  }
  return pregunta;
}

function preguntaParaPaso(paso: PasoGuion): string {
  switch (paso) {
    case "nombre":
    case "saludo":
      return "¿Me compartes tu nombre, por favor?";
    case "ocasion":
      return PREGUNTA_OCASION;
    case "fecha":
      return PREGUNTA_FECHA;
    case "aforo":
      return COPY_AFORO;
    case "intencion":
    case "presupuesto":
      return PREGUNTA_INTENCION;
    default:
      return COPY_FAQ_LIBRE;
  }
}

function replySedeEIntencion(campos: CamposCapturados): ScriptTurnResult {
  assignSedeUnica(campos);
  return {
    ...reply(COPY_SEDE_E_INTENCION, "intencion", campos),
    adjuntoGuion: GUION_ADJUNTO_PAQUETE_BODAS,
  };
}

function reply(
  textoRespuesta: string,
  pasoGuion: PasoGuion,
  camposCapturados: CamposCapturados,
  guionCompleto = false,
  adjuntoGuion?: GuionAdjuntoId,
): ScriptTurnResult {
  return {
    textoRespuesta,
    pasoGuion,
    camposCapturados,
    avanzado: true,
    guionCompleto,
    adjuntoGuion,
  };
}
