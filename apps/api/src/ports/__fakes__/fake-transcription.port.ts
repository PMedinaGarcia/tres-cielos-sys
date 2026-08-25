import type {
  TranscriptionPort,
  TranscriptionRequest,
  TranscriptionResult,
} from "../transcription.port";
import { InvalidMediaError, ProviderUnavailableError } from "../errors";

const DEFAULT_MODEL = "fake-whisper";

/**
 * Fake Whisper: transcript golden por fixture.
 */
export class FakeTranscriptionPort implements TranscriptionPort {
  private readonly fixtures = new Map<string, TranscriptionResult>();
  private failNext = false;

  constructor() {
    this.fixtures.set("default", {
      text: "Fake transcript: bienvenidos a Tres Cielos, horarios de visita.",
      model: DEFAULT_MODEL,
      durationSec: 12,
    });
  }

  setFixture(
    name: string,
    result: Omit<TranscriptionResult, "model"> & { model?: string },
  ): void {
    this.fixtures.set(name, { ...result, model: result.model ?? DEFAULT_MODEL });
  }

  simulateFailure(enabled = true): void {
    this.failNext = enabled;
  }

  async transcribeAudio(request: TranscriptionRequest): Promise<TranscriptionResult> {
    if (this.failNext) {
      this.failNext = false;
      throw new ProviderUnavailableError(
        "Fake Whisper simulated failure",
        "fake-whisper",
      );
    }
    const key = request.fixtureName ?? request.audioRef;
    const hit = this.fixtures.get(key) ?? this.fixtures.get("default");
    if (!hit) {
      throw new InvalidMediaError(`No transcription fixture for ${key}`, "fake-whisper");
    }
    return { ...hit, model: request.model ?? hit.model };
  }
}
