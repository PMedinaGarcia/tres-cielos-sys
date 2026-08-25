import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import { toFile } from "openai";
import type {
  TranscriptionPort,
  TranscriptionRequest,
  TranscriptionResult,
} from "../ports/transcription.port";
import { InvalidMediaError } from "../ports/errors";
import { mapOpenAiError } from "./openai.llm.adapter";
import type { ObjectStoragePort } from "../ports/object-storage.port";
import { OBJECT_STORAGE_PORT } from "../ports/tokens";

@Injectable()
export class OpenAiTranscriptionAdapter implements TranscriptionPort {
  private readonly client: OpenAI;
  private readonly defaultModel: string;
  private readonly timeoutMs: number;

  constructor(
    private readonly config: ConfigService,
    @Inject(OBJECT_STORAGE_PORT) private readonly storage: ObjectStoragePort,
  ) {
    const apiKey = this.config.get<string>("ai.openai.apiKey");
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY missing for transcription adapter");
    }
    this.timeoutMs = this.config.get<number>("ai.caps.requestTimeoutMs") ?? 45_000;
    this.client = new OpenAI({
      apiKey,
      baseURL: this.config.get<string>("ai.openai.baseUrl"),
      timeout: this.timeoutMs,
      maxRetries: this.config.get<number>("ai.caps.maxRetries") ?? 2,
    });
    this.defaultModel =
      this.config.get<string>("ai.openai.whisperModel") ?? "whisper-1";
  }

  async transcribeAudio(request: TranscriptionRequest): Promise<TranscriptionResult> {
    try {
      const obj = await this.storage.get(request.audioRef);
      const file = await toFile(obj.body, request.audioRef.split("/").pop() ?? "audio.mp4", {
        type: obj.contentType ?? "audio/mpeg",
      });
      const response = await this.client.audio.transcriptions.create({
        file,
        model: request.model ?? this.defaultModel,
        language: request.language,
      });
      return {
        text: response.text,
        model: request.model ?? this.defaultModel,
      };
    } catch (err) {
      if (err instanceof InvalidMediaError) throw err;
      throw mapOpenAiError(err, this.timeoutMs);
    }
  }
}
