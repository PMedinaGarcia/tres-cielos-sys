/**
 * Gate no_recuperable_precio — anti-cotización desde OCR/RAG.
 * Montos SOLO vía tools Prisma.
 */

export type GateAction =
  | "force_tools"
  | "tools_or_handoff"
  | "rag_prose_sin_montos"
  | "handoff_material_ocr"
  | "pass";

export interface GateInput {
  /** Intención monetaria / paquete / inclusiones / cuánto sale */
  intencionMonetaria: boolean;
  /** Rama actual considerada */
  rama: "tools" | "rag" | "otro";
  /** Fragmentos RAG recuperados */
  fragmentos?: Array<{ id: string; noRecuperablePrecio: boolean }>;
  /** Adjunto de canal con tarifas visibles (scrub) */
  adjuntoConTarifas?: boolean;
  /** ¿Hay filas de catálogo aplicables? */
  hayFilasCatalogo?: boolean;
}

export { isIntencionMonetaria } from "./monetary-intent";

/**
 * Aplica políticas 02 §4.5.
 * Coverage objetivo: ≥ 80 % branches (suite dedicada).
 */
export function applyNoRecuperablePrecioGate(input: GateInput): GateAction {
  if (input.adjuntoConTarifas && input.intencionMonetaria) {
    if (input.hayFilasCatalogo === true) return "force_tools";
    if (input.hayFilasCatalogo === false) return "handoff_material_ocr";
    return "tools_or_handoff";
  }

  if (input.intencionMonetaria) {
    // Candado 1: intención monetaria → siempre tools
    return "force_tools";
  }

  if (input.rama === "rag") {
    const frags = input.fragmentos ?? [];
    const allFlagged =
      frags.length > 0 && frags.every((f) => f.noRecuperablePrecio);
    const someFlagged = frags.some((f) => f.noRecuperablePrecio);

    if (allFlagged) {
      // Narrativa con solo fragmentos flageados → prosa sin montos
      return "rag_prose_sin_montos";
    }
    if (someFlagged) {
      return "rag_prose_sin_montos";
    }
    return "pass";
  }

  if (input.rama === "tools") {
    return "pass";
  }

  return "pass";
}

/** Post-filtro: elimina patrones de monto de una respuesta narrativa. */
export function stripMontosFromProse(texto: string): string {
  return texto
    .replace(/\$\s?\d[\d,]*(?:\.\d+)?/g, "[monto omitido]")
    .replace(/\b(?:mxn|usd)\s+\d[\d,]*(?:\.\d+)?/gi, "[monto omitido]")
    .replace(/\b\d{4,7}\s*(?:mxn|pesos)\b/gi, "[monto omitido]");
}

export function assertNoInventedMontos(input: {
  respuesta: string;
  montosPermitidos: Array<number | string>;
}): { ok: boolean; montosSospechosos: string[] } {
  const found = [
    ...input.respuesta.matchAll(/\$\s?(\d[\d,]*(?:\.\d+)?)/g),
    ...input.respuesta.matchAll(/\b(?:mxn|usd)\s+(\d[\d,]*(?:\.\d+)?)/gi),
    ...input.respuesta.matchAll(/\b(\d{4,7})\s*(?:mxn|pesos)\b/gi),
  ].map((m) => m[1].replace(/,/g, ""));

  const allowed = new Set(
    input.montosPermitidos.map((m) => String(m).replace(/,/g, "")),
  );
  const sospechosos = found.filter((m) => !allowed.has(m));
  return { ok: sospechosos.length === 0, montosSospechosos: sospechosos };
}
