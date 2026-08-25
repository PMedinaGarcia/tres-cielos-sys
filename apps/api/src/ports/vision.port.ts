export interface VisionRequest {
  /** Clave en object storage o data URL / path de fixture en fake. */
  imageRef: string;
  prompt?: string;
  model?: string;
  /** Nombre de fixture golden (solo fake / tests). */
  fixtureName?: string;
}

export interface VisionResult {
  text: string;
  model: string;
  /** Montos detectados solo para scrub — nunca para cotizar. */
  detectedAmounts?: string[];
}

/**
 * Port Vision (OCR / caption controlado).
 * Prod: OpenAI Vision. CI: FakeVisionPort por fixture.
 */
export interface VisionPort {
  describeOrExtractText(request: VisionRequest): Promise<VisionResult>;
}
