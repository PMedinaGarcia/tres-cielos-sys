import { Inject, Injectable } from "@nestjs/common";
import { isProviderError } from "../ports/errors";
import type { LlmPort } from "../ports/llm.port";
import { LLM_PORT } from "../ports/tokens";
import {
  detectIntencionMonetariaEnQuery,
  stripMontos,
  textoContieneMontos,
} from "./anti-hallucination.util";
import {
  citaCoincideConFragmentos,
  extractCita,
  hasCitaTipada,
} from "./citation.util";
import {
  MotivoHandoffRag,
  RerankedCandidate,
  SAFE_COPY_K09,
} from "./types";

export class GeneratorProviderError extends Error {
  readonly code = "GENERATOR_PROVIDER_ERROR" as const;
  readonly motivoHandoff = "proveedor_ia" as const;

  constructor(cause?: unknown) {
    const msg =
      cause instanceof Error ? cause.message : "Fallo en LlmPort (generador RAG)";
    super(msg);
    this.name = "GeneratorProviderError";
  }
}

export interface GenerateInput {
  query: string;
  fragments: RerankedCandidate[];
  intencionMonetaria?: boolean;
}

export interface GenerateResult {
  ok: boolean;
  texto?: string;
  cita?: string;
  motivoHandoff?: MotivoHandoffRag;
  redirigirTools?: boolean;
  montosEliminados?: boolean;
}

export const RAG_SYSTEM_PROMPT = `Eres un asistente estricto del venue Tres Cielos. Responde basándote ÚNICAMENTE en los fragmentos de contexto proporcionados. Si la respuesta no está claramente detallada en el contexto, debes responder con el copy seguro aprobado (“No tengo esa información en mi base de conocimiento…”) e invocar transferencia a humano. NUNCA inventes, deduzcas ni combines datos que no estén explícitos. No cites precios numéricos desde contexto narrativo (incluido texto derivado de foto/video u OCR) si el orquestador debió usar catálogo. Al final, cita la fuente: [Fuente: nombre_archivo | tipo: tipo_material].`;

/**
 * D3 — Generador + validación post-hoc de cita tipada.
 * Gates: intención monetaria; no_recuperable_precio (prosa OK, montos no).
 */
@Injectable()
export class GeneratorService {
  constructor(@Inject(LLM_PORT) private readonly llm: LlmPort) {}

  async generate(input: GenerateInput): Promise<GenerateResult> {
    const monetaria =
      input.intencionMonetaria === true ||
      detectIntencionMonetariaEnQuery(input.query);

    if (monetaria) {
      return {
        ok: false,
        motivoHandoff: "intencion_monetaria",
        redirigirTools: true,
        texto: SAFE_COPY_K09,
      };
    }

    if (input.fragments.length === 0) {
      return {
        ok: false,
        motivoHandoff: "rerank_bajo",
        texto: SAFE_COPY_K09,
      };
    }

    const userPrompt = buildUserPrompt(input.query, input.fragments);

    let raw: string;
    try {
      const result = await this.llm.complete({
        messages: [
          { role: "system", content: RAG_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        maxTokens: 800,
      });
      raw = result.content.trim();
    } catch (err) {
      if (isProviderError(err) || err instanceof Error) {
        throw new GeneratorProviderError(err);
      }
      throw new GeneratorProviderError(err);
    }

    if (!hasCitaTipada(raw)) {
      return {
        ok: false,
        motivoHandoff: "sin_cita_rag",
        texto: SAFE_COPY_K09,
      };
    }

    const cita = extractCita(raw)!;
    const metas = input.fragments.map((f) => ({
      nombreArchivoCita: f.fragmento.nombreArchivoCita,
      tipoMaterial: f.fragmento.tipoMaterial,
    }));

    if (!citaCoincideConFragmentos(cita, metas)) {
      return {
        ok: false,
        motivoHandoff: "sin_cita_rag",
        texto: SAFE_COPY_K09,
      };
    }

    let texto = raw;
    let montosEliminados = false;
    const usaNoRecuperable = input.fragments.some(
      (f) => f.fragmento.noRecuperablePrecio,
    );

    if (usaNoRecuperable && textoContieneMontos(texto)) {
      texto = stripMontos(texto);
      montosEliminados = true;
      if (!hasCitaTipada(texto)) {
        texto = `${texto.replace(/\s+$/, "")}\n${cita.raw}`;
      }
    }

    return {
      ok: true,
      texto,
      cita: cita.raw,
      montosEliminados,
    };
  }
}

export function buildUserPrompt(
  query: string,
  fragments: RerankedCandidate[],
): string {
  const blocks = fragments.map((f, i) => {
    const meta = `meta: nombreArchivoCita=${f.fragmento.nombreArchivoCita} | tipoMaterial=${f.fragmento.tipoMaterial} | score=${f.scoreRerank.toFixed(3)} | no_recuperable_precio=${f.fragmento.noRecuperablePrecio}`;
    return `---FRAGMENTO ${i + 1}---\n${meta}\n${f.fragmento.texto}\n---END---`;
  });

  return [
    `Pregunta del prospecto: ${query}`,
    "",
    "Fragmentos autorizados (usa SOLO este contexto):",
    ...blocks,
    "",
    "Responde en español. Termina obligatoriamente con [Fuente: nombre_archivo | tipo: tipo_material] de uno de los fragmentos anteriores.",
  ].join("\n");
}
