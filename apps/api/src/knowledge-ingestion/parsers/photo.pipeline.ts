import { Inject, Injectable } from "@nestjs/common";
import { VISION_PORT } from "../../ports/tokens";
import type { VisionPort } from "../../ports/vision.port";
import { TariffScrubService } from "../scrub/tariff-scrub.service";
import type { ParsedFragment } from "../contracts/media.types";

@Injectable()
export class PhotoPipeline {
  constructor(
    @Inject(VISION_PORT) private readonly vision: VisionPort,
    private readonly scrub: TariffScrubService,
  ) {}

  async process(input: {
    storageKey: string;
    mime: string;
    signedUrl?: string;
  }): Promise<ParsedFragment[]> {
    const lower = input.storageKey.toLowerCase();
    const fixtureName =
      lower.includes("tarifa") || lower.includes("precio")
        ? "tarifa"
        : "default";
    const described = await this.vision.describeOrExtractText({
      imageRef: input.signedUrl ?? input.storageKey,
      fixtureName,
      prompt:
        "Describe venue/ambiente/texto visible. No inventar precios; listar montos solo para scrub.",
    });
    const scrubbed = this.scrub.scrub(described.text);
    const noRecuperable =
      scrubbed.noRecuperablePrecio ||
      (described.detectedAmounts?.length ?? 0) > 0;
    return [
      {
        texto: scrubbed.textoLimpio,
        noRecuperablePrecio: noRecuperable,
        tipoMaterial: "imagen",
        origenDerivacion: "vision",
        orden: 0,
      },
    ];
  }
}
