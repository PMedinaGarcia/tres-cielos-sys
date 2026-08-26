import { Injectable } from "@nestjs/common";
import type {
  Canal,
  InboundAdjuntoRef,
  InboundMessage,
} from "./types/inbound-message";

@Injectable()
export class MessageNormalizerService {
  fromMeta(payload: unknown): InboundMessage[] {
    const root = payload as {
      entry?: Array<{
        messaging?: Array<Record<string, unknown>>;
        changes?: Array<{ value?: Record<string, unknown> }>;
      }>;
      object?: string;
    };

    const out: InboundMessage[] = [];
    const object = root.object ?? "page";
    const canal: Canal =
      object === "instagram" ? "instagram" : "facebook";

    for (const entry of root.entry ?? []) {
      const messaging =
        entry.messaging ??
        entry.changes?.flatMap((c) => {
          const v = c.value;
          if (v?.messaging && Array.isArray(v.messaging)) {
            return v.messaging as Array<Record<string, unknown>>;
          }
          // IG / Messenger unified sometimes nests messages
          if (v?.messages && Array.isArray(v.messages)) {
            const contacts = Array.isArray(v.contacts)
              ? (v.contacts as Array<{ id?: string }>)
              : [];
            return (v.messages as Array<Record<string, unknown>>).map((m) => ({
              sender: v.sender ?? { id: contacts[0]?.id },
              recipient: v.recipient,
              timestamp: m.timestamp,
              message: m,
            }));
          }
          return [];
        }) ??
        [];

      for (const evt of messaging) {
        const message = (evt.message ?? evt) as Record<string, unknown>;
        const mid = String(message.mid ?? message.id ?? "");
        if (!mid) continue;
        const text = String(message.text ?? "");
        const sender = (evt.sender ?? {}) as { id?: string };
        const attachments = normalizeMetaAttachments(message.attachments);
        out.push({
          canal,
          externalThreadId: String(sender.id ?? "unknown"),
          externalMessageId: mid,
          texto: text,
          recibidoEn: new Date(
            Number(evt.timestamp ?? Date.now()),
          ).toISOString(),
          perfilCanal: {
            nombre: null,
            psid: sender.id ?? null,
            waId: null,
          },
          adjuntos: attachments,
          meta: { rawEvent: "meta" },
        });
      }
    }
    return out;
  }

  fromTwilioWhatsApp(body: Record<string, string>): InboundMessage {
    const from = body.From ?? body.from ?? "";
    const waId = from.replace(/^whatsapp:/i, "");
    const numMedia = Number(body.NumMedia ?? "0");
    const adjuntos: InboundAdjuntoRef[] = [];
    for (let i = 0; i < numMedia; i++) {
      const url = body[`MediaUrl${i}`];
      const mime = body[`MediaContentType${i}`] ?? "application/octet-stream";
      if (url) {
        adjuntos.push({
          urlExterna: url,
          mime,
          nombreOriginal: `media-${i}`,
        });
      }
    }
    const buttonPayload = (
      body.ButtonPayload ??
      body.buttonPayload ??
      body.ListId ??
      body.listId ??
      ""
    ).trim();
    const buttonText = (
      body.ButtonText ??
      body.buttonText ??
      body.ListTitle ??
      body.listTitle ??
      ""
    ).trim();
    const bodyText = (body.Body ?? body.body ?? "").trim();

    return {
      canal: "whatsapp",
      externalThreadId: `wa:${waId}`,
      externalMessageId: body.MessageSid ?? body.SmsMessageSid ?? body.SmsSid ?? "",
      texto: bodyText || buttonText,
      recibidoEn: new Date().toISOString(),
      perfilCanal: {
        nombre: body.ProfileName ?? null,
        psid: null,
        waId,
      },
      adjuntos,
      buttonPayload: buttonPayload || undefined,
      meta: {
        twilioAccountSid: body.AccountSid,
        ...(buttonPayload ? { interactiveType: body.ListId ? "list" : "button" } : {}),
      },
    };
  }
}

function normalizeMetaAttachments(raw: unknown): InboundAdjuntoRef[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((a) => {
    const item = a as {
      type?: string;
      payload?: { url?: string };
    };
    const mimeGuess =
      item.type === "image"
        ? "image/jpeg"
        : item.type === "video"
          ? "video/mp4"
          : "application/octet-stream";
    return {
      urlExterna: item.payload?.url,
      mime: mimeGuess,
      nombreOriginal: item.type ?? "attachment",
    };
  });
}
