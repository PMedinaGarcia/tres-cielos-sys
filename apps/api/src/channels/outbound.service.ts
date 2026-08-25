import { Injectable, Logger } from "@nestjs/common";
import type { OutboundMessage } from "./types/inbound-message";

export interface OutboundSendResult {
  ok: boolean;
  providerMessageId?: string;
  skipped?: boolean;
  reason?: string;
}

/**
 * Reply por canal de origen. Sin keys → no-op log (CI/smoke).
 */
@Injectable()
export class OutboundService {
  private readonly logger = new Logger(OutboundService.name);
  private readonly sent: OutboundMessage[] = [];

  async send(message: OutboundMessage): Promise<OutboundSendResult> {
    this.sent.push(message);
    if (message.canal === "whatsapp") {
      return this.sendTwilio(message);
    }
    return this.sendMeta(message);
  }

  private async sendTwilio(message: OutboundMessage): Promise<OutboundSendResult> {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_WHATSAPP_FROM;
    if (!sid || !token || !from) {
      this.logger.warn("Twilio outbound skipped (missing env)");
      return { ok: true, skipped: true, reason: "TWILIO_ENV_MISSING" };
    }
    // Prod: POST https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json
    this.logger.log(`Twilio WA → ${message.externalThreadId}`);
    return { ok: true, providerMessageId: `stub-twilio-${Date.now()}` };
  }

  private async sendMeta(message: OutboundMessage): Promise<OutboundSendResult> {
    const token = process.env.META_PAGE_ACCESS_TOKEN;
    if (!token) {
      this.logger.warn("Meta outbound skipped (missing META_PAGE_ACCESS_TOKEN)");
      return { ok: true, skipped: true, reason: "META_ENV_MISSING" };
    }
    this.logger.log(`Meta → ${message.externalThreadId}`);
    return { ok: true, providerMessageId: `stub-meta-${Date.now()}` };
  }

  /** Tests */
  drain(): OutboundMessage[] {
    return this.sent.splice(0, this.sent.length);
  }
}
