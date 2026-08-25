import { Injectable } from "@nestjs/common";
import type {
  TranscriptionPort,
  TranscriptionRequest,
  TranscriptionResult,
} from "../contracts/transcription.port";

/**
 * Fake Whisper CI. Specs reales: `@live`.
 */
@Injectable()
export class FakeTranscriptionAdapter implements TranscriptionPort {
  async transcribeAudio(
    request: TranscriptionRequest,
  ): Promise<TranscriptionResult> {
    const name = (request.fixtureName ?? request.audioRef).toLowerCase();
    if (name.includes("tarifa") || name.includes("precio")) {
      return {
        text: "Hola, el paquete esencial cuesta cuarenta y cinco mil pesos MXN con anticipo de diez mil.",
        model: "fake-whisper",
        durationSec: 12,
      };
    }
    return {
      text: "Recorrido por el jardín. Horario de visitas de martes a domingo. Consultar políticas de lluvia en recepción.",
      model: "fake-whisper",
      durationSec: 30,
    };
  }
}
