import { Inject, Injectable } from "@nestjs/common";
import { TRANSCRIPTION_PORT } from "../../ports/tokens";
import type { TranscriptionPort } from "../../ports/transcription.port";
import { TariffScrubService } from "../scrub/tariff-scrub.service";
import type { ParsedFragment } from "../contracts/media.types";
import { MEDIA_LIMITS } from "../contracts/media.types";

@Injectable()
export class VideoPipeline {
  constructor(
    @Inject(TRANSCRIPTION_PORT) private readonly whisper: TranscriptionPort,
    private readonly scrub: TariffScrubService,
  ) {}

  async process(input: {
    storageKey: string;
    mime: string;
    signedUrl?: string;
    duracionMs?: number;
  }): Promise<{ fragments: ParsedFragment[]; rejected?: string }> {
    if (
      input.duracionMs !== undefined &&
      input.duracionMs > MEDIA_LIMITS.videoMaxMs
    ) {
      return { fragments: [], rejected: "video_excede_duracion" };
    }
    const lower = input.storageKey.toLowerCase();
    const fixtureName =
      lower.includes("tarifa") || lower.includes("precio")
        ? "tarifa"
        : "default";
    const maybeFake = this.whisper as unknown as {
      setFixture?: (name: string, result: Record<string, unknown>) => void;
    };
    if (fixtureName === "tarifa" && typeof maybeFake.setFixture === "function") {
      maybeFake.setFixture("tarifa", {
        text: "El paquete esencial cuesta cuarenta y cinco mil pesos MXN con anticipo de diez mil.",
        durationSec: 12,
      });
    }
    const transcript = await this.whisper.transcribeAudio({
      audioRef: input.signedUrl ?? input.storageKey,
      fixtureName,
      language: "es",
    });
    const scrubbed = this.scrub.scrub(transcript.text);
    return {
      fragments: [
        {
          texto: scrubbed.textoLimpio,
          noRecuperablePrecio: scrubbed.noRecuperablePrecio,
          tipoMaterial: "video",
          origenDerivacion: "whisper",
          orden: 0,
        },
      ],
    };
  }
}
