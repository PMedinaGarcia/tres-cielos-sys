import { Injectable, Logger } from "@nestjs/common";
import {
  detectIntencionMonetariaEnQuery,
} from "./anti-hallucination.util";
import { GeneratorProviderError, GeneratorService } from "./generator.service";
import { HybridSearchService } from "./hybrid-search.service";
import { RegistroRecuperacionService } from "./registro-recuperacion.service";
import { RerankProviderError, RerankService } from "./rerank.service";
import {
  RagAnswerContext,
  RagAnswerResult,
  SAFE_COPY_K09,
} from "./types";

/**
 * API pública del RagPipelineModule para el orquestador.
 *
 * Flujo: hybrid → rerank ≥ umbral → generador + cita → RegistroRecuperacion.
 * C5: ninguna respuesta ok con max score < 0.85.
 */
@Injectable()
export class RagPipelineService {
  private readonly logger = new Logger(RagPipelineService.name);

  constructor(
    private readonly hybrid: HybridSearchService,
    private readonly rerank: RerankService,
    private readonly generator: GeneratorService,
    private readonly registros: RegistroRecuperacionService,
  ) {}

  async answer(
    query: string,
    context: RagAnswerContext = {},
  ): Promise<RagAnswerResult> {
    const queryEffective = context.queryRewrite?.trim() || query;
    const monetaria =
      context.intencionMonetaria === true ||
      detectIntencionMonetariaEnQuery(query);

    if (monetaria) {
      const registro = this.registros.create({
        queryOriginal: query,
        queryRewrite: context.queryRewrite ?? null,
        umbral: this.rerank.getUmbral(),
        conversacionId: context.conversacionId,
        mensajeId: context.mensajeId,
        ranked: [],
        finales: [],
        respuestaTexto: SAFE_COPY_K09,
        motivoHandoff: "intencion_monetaria",
        flags: { intencionMonetariaBloqueada: true },
      });
      return {
        ok: false,
        texto: SAFE_COPY_K09,
        scores: [],
        fragmentoIds: [],
        motivoHandoff: "intencion_monetaria",
        redirigirTools: true,
        registroRecuperacionId: registro.id,
      };
    }

    const candidates = await this.hybrid.search(queryEffective, {
      sedeId: context.sedeId,
      corpusIds: context.corpusIds,
      tiposDocumento: context.tiposDocumento,
    });

    if (candidates.length === 0) {
      const registro = this.registros.create({
        queryOriginal: query,
        queryRewrite: context.queryRewrite ?? null,
        umbral: this.rerank.getUmbral(),
        conversacionId: context.conversacionId,
        mensajeId: context.mensajeId,
        ranked: [],
        finales: [],
        respuestaTexto: SAFE_COPY_K09,
        motivoHandoff: "sin_candidatos",
        handoffPorBajaConfianza: true,
      });
      return {
        ok: false,
        texto: SAFE_COPY_K09,
        scores: [],
        fragmentoIds: [],
        motivoHandoff: "sin_candidatos",
        registroRecuperacionId: registro.id,
      };
    }

    let gate;
    try {
      gate = await this.rerank.rerankAndGate(queryEffective, candidates);
    } catch (err) {
      if (err instanceof RerankProviderError) {
        this.logger.warn(`Rerank provider failure: ${err.message}`);
        const registro = this.registros.create({
          queryOriginal: query,
          queryRewrite: context.queryRewrite ?? null,
          umbral: this.rerank.getUmbral(),
          conversacionId: context.conversacionId,
          mensajeId: context.mensajeId,
          ranked: candidates.map((c) => ({ ...c, scoreRerank: 0 })),
          finales: [],
          respuestaTexto: SAFE_COPY_K09,
          motivoHandoff: "proveedor_ia",
          flags: { proveedorFallido: true },
        });
        return {
          ok: false,
          texto: SAFE_COPY_K09,
          scores: [],
          fragmentoIds: [],
          motivoHandoff: "proveedor_ia",
          registroRecuperacionId: registro.id,
        };
      }
      throw err;
    }

    if (!gate.pasaUmbral) {
      // C5: no emitir respuesta anclada con max < umbral
      const registro = this.registros.create({
        queryOriginal: query,
        queryRewrite: context.queryRewrite ?? null,
        umbral: gate.umbral,
        conversacionId: context.conversacionId,
        mensajeId: context.mensajeId,
        ranked: gate.ranked,
        finales: [],
        respuestaTexto: SAFE_COPY_K09,
        motivoHandoff: "rerank_bajo",
        handoffPorBajaConfianza: true,
      });
      return {
        ok: false,
        texto: SAFE_COPY_K09,
        scores: gate.ranked.map((r) => r.scoreRerank),
        fragmentoIds: [],
        motivoHandoff: "rerank_bajo",
        registroRecuperacionId: registro.id,
      };
    }

    let gen;
    try {
      gen = await this.generator.generate({
        query: queryEffective,
        fragments: gate.aboveThreshold,
        intencionMonetaria: false,
      });
    } catch (err) {
      if (err instanceof GeneratorProviderError) {
        const registro = this.registros.create({
          queryOriginal: query,
          queryRewrite: context.queryRewrite ?? null,
          umbral: gate.umbral,
          conversacionId: context.conversacionId,
          mensajeId: context.mensajeId,
          ranked: gate.ranked,
          finales: gate.aboveThreshold,
          respuestaTexto: SAFE_COPY_K09,
          motivoHandoff: "proveedor_ia",
          flags: { proveedorFallido: true },
        });
        return {
          ok: false,
          texto: SAFE_COPY_K09,
          scores: gate.aboveThreshold.map((r) => r.scoreRerank),
          fragmentoIds: gate.aboveThreshold.map((r) => r.fragmento.id),
          motivoHandoff: "proveedor_ia",
          registroRecuperacionId: registro.id,
        };
      }
      throw err;
    }

    if (!gen.ok) {
      const registro = this.registros.create({
        queryOriginal: query,
        queryRewrite: context.queryRewrite ?? null,
        umbral: gate.umbral,
        conversacionId: context.conversacionId,
        mensajeId: context.mensajeId,
        ranked: gate.ranked,
        finales: gate.aboveThreshold,
        respuestaTexto: gen.texto ?? SAFE_COPY_K09,
        motivoHandoff: gen.motivoHandoff ?? "otro",
        handoffPorBajaConfianza: gen.motivoHandoff === "rerank_bajo",
        flags: {
          sinCita: gen.motivoHandoff === "sin_cita_rag",
          intencionMonetariaBloqueada: gen.redirigirTools === true,
        },
      });
      return {
        ok: false,
        texto: gen.texto ?? SAFE_COPY_K09,
        scores: gate.aboveThreshold.map((r) => r.scoreRerank),
        fragmentoIds: [],
        motivoHandoff: gen.motivoHandoff,
        redirigirTools: gen.redirigirTools,
        registroRecuperacionId: registro.id,
      };
    }

    const registro = this.registros.create({
      queryOriginal: query,
      queryRewrite: context.queryRewrite ?? null,
      umbral: gate.umbral,
      conversacionId: context.conversacionId,
      mensajeId: context.mensajeId,
      ranked: gate.ranked,
      finales: gate.aboveThreshold,
      respuestaTexto: gen.texto ?? null,
      cita: gen.cita ?? null,
      motivoHandoff: null,
      handoffPorBajaConfianza: false,
    });

    return {
      ok: true,
      texto: gen.texto,
      cita: gen.cita,
      scores: gate.aboveThreshold.map((r) => r.scoreRerank),
      fragmentoIds: gate.aboveThreshold.map((r) => r.fragmento.id),
      registroRecuperacionId: registro.id,
    };
  }
}
