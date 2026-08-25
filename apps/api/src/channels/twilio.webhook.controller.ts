import {
  Controller,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { TwilioSignatureGuard } from "./guards/twilio-signature.guard";
import { MessageNormalizerService } from "./message-normalizer.service";
import { InboundPipelineService } from "./inbound-pipeline.service";

/**
 * POST /webhooks/twilio/whatsapp — firma Twilio, ACK 200, sin JWT.
 */
@Controller("webhooks/twilio/whatsapp")
export class TwilioWebhookController {
  constructor(
    private readonly normalizer: MessageNormalizerService,
    private readonly pipeline: InboundPipelineService,
  ) {}

  @Post()
  @HttpCode(200)
  @UseGuards(TwilioSignatureGuard)
  async receive(@Req() req: Request) {
    const body = (req.body ?? {}) as Record<string, string>;
    const message = this.normalizer.fromTwilioWhatsApp(body);
    setImmediate(() => {
      void this.pipeline.process(message);
    });
    // Twilio acepta TwiML vacío o 200
    return { status: "ok" };
  }
}
