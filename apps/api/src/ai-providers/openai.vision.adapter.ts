import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import type { VisionPort, VisionRequest, VisionResult } from "../ports/vision.port";
import { InvalidMediaError } from "../ports/errors";
import { mapOpenAiError } from "./openai.llm.adapter";
import type { ObjectStoragePort } from "../ports/object-storage.port";
import { OBJECT_STORAGE_PORT } from "../ports/tokens";

@Injectable()
export class OpenAiVisionAdapter implements VisionPort {
  private readonly client: OpenAI;
  private readonly defaultModel: string;
  private readonly timeoutMs: number;

  constructor(
    private readonly config: ConfigService,
    @Inject(OBJECT_STORAGE_PORT) private readonly storage: ObjectStoragePort,
  ) {
    const apiKey = this.config.get<string>("ai.openai.apiKey");
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY missing for vision adapter");
    }
    this.timeoutMs = this.config.get<number>("ai.caps.requestTimeoutMs") ?? 45_000;
    this.client = new OpenAI({
      apiKey,
      baseURL: this.config.get<string>("ai.openai.baseUrl"),
      timeout: this.timeoutMs,
      maxRetries: this.config.get<number>("ai.caps.maxRetries") ?? 2,
    });
    this.defaultModel =
      this.config.get<string>("ai.openai.modelVision") ?? "gpt-4.1-mini";
  }

  async describeOrExtractText(request: VisionRequest): Promise<VisionResult> {
    try {
      const imageUrl = await this.resolveImageUrl(request.imageRef);
      const prompt =
        request.prompt ??
        "Describe el contenido visible. Lista montos/textos de tarifas solo para auditoría; no cotices.";
      const response = await this.client.chat.completions.create({
        model: request.model ?? this.defaultModel,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
        max_tokens: 800,
      });
      const text = response.choices[0]?.message?.content ?? "";
      const detectedAmounts = text.match(/\$[\d,.]+|\d+\s*(?:MXN|USD)/gi) ?? [];
      return {
        text,
        model: response.model,
        detectedAmounts,
      };
    } catch (err) {
      if (err instanceof InvalidMediaError) throw err;
      throw mapOpenAiError(err, this.timeoutMs);
    }
  }

  private async resolveImageUrl(imageRef: string): Promise<string> {
    if (imageRef.startsWith("data:") || imageRef.startsWith("http")) {
      return imageRef;
    }
    try {
      const obj = await this.storage.get(imageRef);
      const b64 = obj.body.toString("base64");
      const mime = obj.contentType ?? "image/jpeg";
      return `data:${mime};base64,${b64}`;
    } catch {
      throw new InvalidMediaError(`Cannot load imageRef ${imageRef}`, "openai-vision");
    }
  }
}
