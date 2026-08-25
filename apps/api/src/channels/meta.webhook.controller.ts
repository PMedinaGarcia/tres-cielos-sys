import {
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { MetaSignatureGuard } from "./guards/meta-signature.guard";
import { MessageNormalizerService } from "./message-normalizer.service";
import { InboundPipelineService } from "./inbound-pipeline.service";

/**
 * POST /webhooks/meta — firma Meta, ACK 200 rápido, sin JWT.
 */
@Controller("webhooks/meta")
export class MetaWebhookController {
  constructor(
    private readonly normalizer: MessageNormalizerService,
    private readonly pipeline: InboundPipelineService,
  ) {}

  /** Verificación suscripción Meta */
  @Get()
  verify(
    @Query("hub.mode") mode: string,
    @Query("hub.verify_token") token: string,
    @Query("hub.challenge") challenge: string,
    @Res() res: Response,
  ) {
    const expected =
      process.env.META_VERIFY_TOKEN || "tres-cielos-dev-verify";
    if (mode === "subscribe" && token === expected) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send("Forbidden");
  }

  @Post()
  @HttpCode(200)
  @UseGuards(MetaSignatureGuard)
  async receive(
    @Req() req: Request,
    @Headers() _headers: Record<string, string>,
  ) {
    const messages = this.normalizer.fromMeta(req.body);
    // ACK ya implícito por @HttpCode(200); procesar async
    setImmediate(() => {
      for (const m of messages) {
        void this.pipeline.process(m);
      }
    });
    return { status: "ok" };
  }
}
