import type { VisionPort, VisionRequest, VisionResult } from "../vision.port";
import { InvalidMediaError, ProviderUnavailableError } from "../errors";

const DEFAULT_MODEL = "fake-vision";

/**
 * Fake Vision: golden por nombre de fixture / imageRef.
 */
export class FakeVisionPort implements VisionPort {
  private readonly fixtures = new Map<string, VisionResult>();
  private failNext = false;

  constructor() {
    this.fixtures.set("default", {
      text: "Fake venue description: jardín con iluminación cálida.",
      model: DEFAULT_MODEL,
      detectedAmounts: [],
    });
    this.fixtures.set("tarifa", {
      text: "Tabla visible con encabezado Precios. No cotizar desde OCR.",
      model: DEFAULT_MODEL,
      detectedAmounts: ["$45,000", "$12,000"],
    });
  }

  setFixture(name: string, result: Omit<VisionResult, "model"> & { model?: string }): void {
    this.fixtures.set(name, { ...result, model: result.model ?? DEFAULT_MODEL });
  }

  simulateFailure(enabled = true): void {
    this.failNext = enabled;
  }

  async describeOrExtractText(request: VisionRequest): Promise<VisionResult> {
    if (this.failNext) {
      this.failNext = false;
      throw new ProviderUnavailableError("Fake Vision simulated failure", "fake-vision");
    }
    const key = request.fixtureName ?? request.imageRef;
    const hit = this.fixtures.get(key) ?? this.fixtures.get("default");
    if (!hit) {
      throw new InvalidMediaError(`No vision fixture for ${key}`, "fake-vision");
    }
    return { ...hit, model: request.model ?? hit.model };
  }
}
