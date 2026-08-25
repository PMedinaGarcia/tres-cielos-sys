import { createHash } from "node:crypto";

/** Hash determinista (hex) de un string — usado por fakes CI. */
export function stableHash(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/** Entero unsigned 32-bit derivado de hash. */
export function hashToUint32(input: string, salt = 0): number {
  const h = stableHash(`${salt}:${input}`);
  return Number.parseInt(h.slice(0, 8), 16) >>> 0;
}

/**
 * Vector determinista unitario-ish a partir de texto.
 * Dimensión alineada a text-embedding-3-small (1536).
 */
export function hashToEmbedding(text: string, dimensions = 1536): number[] {
  const out = new Array<number>(dimensions);
  let normSq = 0;
  for (let i = 0; i < dimensions; i++) {
    const v = (hashToUint32(text, i) / 0xffffffff) * 2 - 1;
    out[i] = v;
    normSq += v * v;
  }
  const norm = Math.sqrt(normSq) || 1;
  for (let i = 0; i < dimensions; i++) {
    out[i] = out[i]! / norm;
  }
  return out;
}
