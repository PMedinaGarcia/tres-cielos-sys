import { Injectable, Logger } from "@nestjs/common";
import type { WaContent } from "@tres-cielos/shared";
import type { OutboundMessage } from "./types/inbound-message";

export interface OutboundSendResult {
  ok: boolean;
  providerMessageId?: string;
  skipped?: boolean;
  reason?: string;
}

export type TwilioForm = Record<string, string>;

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
    const fromRaw = process.env.TWILIO_WHATSAPP_FROM;
    if (!sid || !token || !fromRaw) {
      this.logger.warn("Twilio outbound skipped (missing env)");
      return { ok: true, skipped: true, reason: "TWILIO_ENV_MISSING" };
    }
    const from = ensureWhatsappFrom(fromRaw);
    const to = toWhatsappAddress(message.externalThreadId);
    const wa = message.waContent;
    if (
      wa &&
      (wa.kind === "list-picker" || wa.kind === "quick-reply") &&
      !wa.contentSid
    ) {
      this.logger.warn(
        `Twilio content SID missing for ${wa.templateId}; sending session text`,
      );
    }
    const forms = buildTwilioForms({
      from,
      to,
      texto: message.texto,
      wa,
    });
    if (forms.length === 0) {
      return { ok: true, skipped: true, reason: "EMPTY_OUTBOUND" };
    }
    let lastSid: string | undefined;
    for (const form of forms) {
      try {
        lastSid = await postTwilioMessage(sid, token, form);
      } catch (err) {
        const reason = err instanceof Error ? err.message : "TWILIO_SEND_FAILED";
        this.logger.error(`Twilio WA send failed to ${to}: ${reason}`);
        return { ok: false, providerMessageId: lastSid, reason };
      }
    }
    this.logger.log(
      `Twilio WA → ${to} messages=${forms.length}` +
        (wa ? ` template=${wa.templateId} kind=${wa.kind}` : "") +
        (lastSid ? ` last=${lastSid}` : ""),
    );
    return { ok: true, providerMessageId: lastSid };
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

export function toWhatsappAddress(externalThreadId: string): string {
  let raw = externalThreadId.trim().replace(/^wa:/i, "");
  if (/^whatsapp:/i.test(raw)) {
    raw = raw.replace(/^whatsapp:/i, "");
  }
  if (!raw.startsWith("+")) raw = `+${raw}`;
  return `whatsapp:${raw}`;
}

export function ensureWhatsappFrom(from: string): string {
  return toWhatsappAddress(from);
}

/**
 * Parte un turno en mensajes de WhatsApp.
 * Con documentos: texto (plantilla o body), luego el PDF y al final el enlace.
 * Una lista con ContentSid no repite el body.
 */
export function buildTwilioForms(input: {
  from: string;
  to: string;
  texto: string;
  wa?: WaContent;
}): TwilioForm[] {
  const { from, to, wa } = input;
  const forms: TwilioForm[] = [];
  const documents = wa?.documents?.length
    ? wa.documents
    : wa?.document
      ? [wa.document]
      : [];
  const media = documents.filter(
    (document) => document.url && document.delivery !== "link",
  );
  const links = documents.filter(
    (document) => document.url && document.delivery === "link",
  );
  const interactive =
    wa && (wa.kind === "list-picker" || wa.kind === "quick-reply");
  if (interactive && wa.contentSid) {
    const form: TwilioForm = {
      From: from,
      To: to,
      ContentSid: wa.contentSid,
    };
    if (wa.contentVariables && Object.keys(wa.contentVariables).length > 0) {
      form.ContentVariables = JSON.stringify(wa.contentVariables);
    }
    forms.push(form);
  } else {
    const body = (wa?.body || input.texto || "").trim();
    if (body) forms.push({ From: from, To: to, Body: body });
  }
  for (const document of media) {
    const form: TwilioForm = { From: from, To: to, MediaUrl: document.url };
    if (document.filename.trim()) form.Body = document.filename.trim();
    forms.push(form);
  }
  for (const document of links) {
    forms.push({
      From: from,
      To: to,
      Body: `${document.filename.trim()}\n${document.url}`,
    });
  }
  return forms;
}

async function postTwilioMessage(
  accountSid: string,
  token: string,
  form: TwilioForm,
): Promise<string> {
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization:
          "Basic " + Buffer.from(`${accountSid}:${token}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(form),
    },
  );
  const json = (await res.json()) as {
    sid?: string;
    code?: number;
    message?: string;
  };
  if (!res.ok || !json.sid) {
    const code = json.code ?? res.status;
    const detail = json.message ?? "send failed";
    throw new Error(`TWILIO_${code}: ${detail}`);
  }
  return json.sid;
}
