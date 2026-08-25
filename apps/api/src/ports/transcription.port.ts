export interface TranscriptionRequest {
  /** Clave en object storage o path de fixture en fake. */
  audioRef: string;
  language?: string;
  model?: string;
  fixtureName?: string;
}

export interface TranscriptionResult {
  text: string;
  model: string;
  durationSec?: number;
}

/**
 * Port Whisper / transcripción.
 * Prod: OpenAI Whisper. CI: FakeTranscriptionPort (transcript golden).
 */
export interface TranscriptionPort {
  transcribeAudio(request: TranscriptionRequest): Promise<TranscriptionResult>;
}
