import { Injectable } from "@nestjs/common";
import type {
  VisionPort,
  VisionRequest,
  VisionResult,
} from "../contracts/vision.port";

/**
 * Fake CI determinista. Marcar specs reales con `@live`.
 */
@Injectable()
export class FakeVisionAdapter implements VisionPort {
  async describeOrExtractText(request: VisionRequest): Promise<VisionResult> {
    const name = (request.fixtureName ?? request.imageRef).toLowerCase();
    if (name.includes("tarifa") || name.includes("precio")) {
      return {
        text: "Cartel de precios del jardín. Se observan montos $45,000 MXN y anticipo $10,000. Ambiente exterior con fuente.",
        model: "fake-vision",
        detectedAmounts: ["$45,000", "$10,000"],
      };
    }
    return {
      text: "Vista del jardín Tres Cielos al atardecer, mesas redondas y luces cálidas. Sin lista de precios visible.",
      model: "fake-vision",
      detectedAmounts: [],
    };
  }
}
