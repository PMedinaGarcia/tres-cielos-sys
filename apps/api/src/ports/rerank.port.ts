export interface RerankPassage {
  id: string;
  text: string;
}

export interface RerankRequest {
  query: string;
  passages: RerankPassage[];
  topN?: number;
  model?: string;
}

export interface RerankHit {
  id: string;
  score: number;
  index: number;
}

export interface RerankResult {
  hits: RerankHit[];
  model: string;
  threshold: number;
}

/**
 * Port de rerank (Cohere). Umbral producto default 0.85.
 * CI: FakeRerankPort con scores deterministas por id.
 */
export interface RerankPort {
  rerank(request: RerankRequest): Promise<RerankResult>;
}
