import {
  FragmentoRecuperable,
  HybridCandidate,
  OrigenRama,
} from "./types";

const SPANISH_STOPWORDS = new Set([
  "a",
  "al",
  "con",
  "de",
  "del",
  "el",
  "en",
  "es",
  "la",
  "las",
  "lo",
  "los",
  "me",
  "mi",
  "o",
  "para",
  "por",
  "que",
  "se",
  "si",
  "su",
  "un",
  "una",
  "y",
  "ya",
  "como",
  "cual",
  "cuales",
  "cuando",
  "donde",
  "hay",
  "tiene",
  "tienen",
  "son",
  "sobre",
  "este",
  "esta",
  "estos",
  "estas",
]);

export function cosineSimilarity(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

export function tokenizeSpanish(text: string): Set<string> {
  const raw = text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((t) => t.length > 2 && !SPANISH_STOPWORDS.has(t));
  return new Set(raw);
}

export function ftsRank(queryTokens: Set<string>, docText: string): number {
  const docTokens = tokenizeSpanish(docText);
  if (docTokens.size === 0) return 0;
  let hits = 0;
  for (const t of queryTokens) {
    if (docTokens.has(t)) hits += 1;
  }
  if (hits === 0) return 0;
  return hits / queryTokens.size + hits / (docTokens.size + 1);
}

export function fuseAndDedupe(
  vectorHits: Array<{ fragmento: FragmentoRecuperable; score: number }>,
  ftsHits: Array<{ fragmento: FragmentoRecuperable; score: number }>,
  topN: number,
): HybridCandidate[] {
  const map = new Map<string, HybridCandidate>();

  for (const h of vectorHits) {
    map.set(h.fragmento.id, {
      fragmento: h.fragmento,
      scoreHybrid: h.score,
      scoreVector: h.score,
      origenRama: "vector",
    });
  }

  for (const h of ftsHits) {
    const existing = map.get(h.fragmento.id);
    if (!existing) {
      map.set(h.fragmento.id, {
        fragmento: h.fragmento,
        scoreHybrid: h.score,
        scoreFts: h.score,
        origenRama: "fts",
      });
      continue;
    }
    existing.scoreFts = h.score;
    existing.origenRama = "ambos" satisfies OrigenRama;
    existing.scoreHybrid = Math.max(existing.scoreHybrid, h.score);
  }

  return [...map.values()]
    .sort((a, b) => b.scoreHybrid - a.scoreHybrid)
    .slice(0, topN);
}
