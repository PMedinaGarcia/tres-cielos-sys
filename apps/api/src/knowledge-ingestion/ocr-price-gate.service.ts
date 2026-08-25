import { Injectable } from "@nestjs/common";
import { TariffScrubService } from "./scrub/tariff-scrub.service";
import type { FragmentoRecord } from "./repository/knowledge.repository.stub";

export interface OcrGateInput {
  pregunta: string;
  fragments: Array<
    Pick<FragmentoRecord, "texto" | "noRecuperablePrecio" | "origenDerivacion">
  >;
  /** true si la intención es monetaria / cotizar */
  intencionMonetaria: boolean;
}

export type OcrGateDecision =
  | { action: "allow_prose"; contextTexts: string[]; montosDesdeOcr: string[] }
  | {
      action: "tools_or_handoff";
      motivoHandoff: "material_ocr_tarifas";
      montosDesdeOcr: string[];
      contextTexts: string[];
    }
  | {
      action: "strip_amounts";
      contextTexts: string[];
      montosDesdeOcr: string[];
    };

/**
 * E7 / D-MED-10: 0 montos desde OCR en consumo.
 * Scrub + tools/handoff `material_ocr_tarifas`.
 */
@Injectable()
export class OcrPriceGateService {
  constructor(private readonly scrub: TariffScrubService) {}

  evaluate(input: OcrGateInput): OcrGateDecision {
    const flagged = input.fragments.filter((f) => f.noRecuperablePrecio);
    const fromVisionWhisper = input.fragments.filter(
      (f) =>
        f.origenDerivacion === "vision" || f.origenDerivacion === "whisper",
    );

    const montosDesdeOcr: string[] = [];
    for (const f of [...flagged, ...fromVisionWhisper]) {
      for (const m of this.scrub.extractRawAmounts(f.texto)) {
        if (!montosDesdeOcr.includes(m)) montosDesdeOcr.push(m);
      }
    }

    // Invariante: consumidores deben ver 0 montos OCR en el contexto entregado
    const contextTexts = input.fragments.map((f) => {
      if (f.noRecuperablePrecio) {
        return this.scrub.scrub(f.texto).textoLimpio;
      }
      if (
        f.origenDerivacion === "vision" ||
        f.origenDerivacion === "whisper"
      ) {
        return this.scrub.scrub(f.texto).textoLimpio;
      }
      return f.texto;
    });

    const residualAmounts = contextTexts.flatMap((t) =>
      this.scrub.extractRawAmounts(t),
    );
    // Garantía binaria: strip residual
    const safeContext = residualAmounts.length
      ? contextTexts.map((t) => this.scrub.scrub(t).textoLimpio)
      : contextTexts;

    if (input.intencionMonetaria && (flagged.length > 0 || montosDesdeOcr.length > 0)) {
      return {
        action: "tools_or_handoff",
        motivoHandoff: "material_ocr_tarifas",
        montosDesdeOcr,
        contextTexts: safeContext,
      };
    }

    if (flagged.length > 0) {
      return {
        action: "strip_amounts",
        contextTexts: safeContext,
        montosDesdeOcr,
      };
    }

    return {
      action: "allow_prose",
      contextTexts: safeContext,
      montosDesdeOcr: [],
    };
  }

  /** Assert helper: conteo de montos en textos de contexto post-gate. */
  countAmounts(texts: string[]): number {
    return texts.reduce(
      (n, t) => n + this.scrub.extractRawAmounts(t).length,
      0,
    );
  }
}
