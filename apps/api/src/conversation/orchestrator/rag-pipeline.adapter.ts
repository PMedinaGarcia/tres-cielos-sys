import { Injectable } from "@nestjs/common";
import { RagPipelineService } from "../../rag/rag-pipeline.service";
import { DEFAULT_RERANK_THRESHOLD } from "../../rag/types";
import type {
  RagPipelinePort,
  RagPipelineResult,
} from "../stubs/rag-pipeline.port";

/**
 * Adapta RagPipelineService (hybrid → rerank → cita) al port del orquestador.
 */
@Injectable()
export class RagPipelineAdapter implements RagPipelinePort {
  constructor(private readonly rag: RagPipelineService) {}

  async answer(input: {
    query: string;
    conversacionId: string;
    mensajeId?: string;
    sedeId?: string | null;
    corpusIds?: string[];
    tiposDocumento?: string[];
  }): Promise<RagPipelineResult> {
    const result = await this.rag.answer(input.query, {
      conversacionId: input.conversacionId,
      mensajeId: input.mensajeId,
      sedeId: input.sedeId,
      corpusIds: input.corpusIds,
      tiposDocumento: input.tiposDocumento,
    });

    const motivoFallo = mapMotivo(result.motivoHandoff);

    return {
      ok: result.ok,
      texto: result.texto,
      motivoFallo,
      scoresRerank: result.scores,
      fragmentoIds: result.fragmentoIds,
      registroRecuperacionId: result.registroRecuperacionId,
      cita: result.cita,
      umbral: DEFAULT_RERANK_THRESHOLD,
      redirigirTools: result.redirigirTools,
    };
  }
}

function mapMotivo(
  motivo?: string,
): RagPipelineResult["motivoFallo"] {
  if (!motivo) return undefined;
  if (motivo === "rerank_bajo") return "rerank_bajo";
  if (motivo === "sin_cita_rag" || motivo === "sin_candidatos") {
    return "sin_cita_rag";
  }
  if (motivo === "proveedor_ia") return "proveedor_ia";
  if (motivo === "intencion_monetaria") return undefined;
  return "sin_fragmentos";
}
