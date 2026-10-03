import { Injectable } from "@nestjs/common";
import { normalizeTelefono } from "../conversation/telefono";
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
      for (const evt of entry.messaging ?? []) {
        const msg = fromPageEvent(canal, evt);
        if (msg) out.push(msg);
      }

      for (const change of entry.changes ?? []) {
        const v = change.value;
        if (!v) continue;
        if (
          object === "whatsapp_business_account" ||
          v.messaging_product === "whatsapp"
        ) {
          out.push(...fromWhatsAppCloud(v));
          continue;
        }
        if (v.messaging && Array.isArray(v.messaging)) {
          for (const evt of v.messaging as Array<Record<string, unknown>>) {
            const msg = fromPageEvent(canal, evt);
            if (msg) out.push(msg);
          }
          continue;
        }
        if (v.messages && Array.isArray(v.messages)) {
          const contacts = Array.isArray(v.contacts)
            ? (v.contacts as Array<{ id?: string }>)
            : [];
          for (const m of v.messages as Array<Record<string, unknown>>) {
            const msg = fromPageEvent(canal, {
              sender: v.sender ?? { id: contacts[0]?.id },
              recipient: v.recipient,
              timestamp: m.timestamp,
              message: m,
            });
            if (msg) out.push(msg);
          }
        }
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

function fromPageEvent(
  canal: Canal,
  evt: Record<string, unknown>,
): InboundMessage | null {
  const message = (evt.message ?? evt) as Record<string, unknown>;
  const mid = String(message.mid ?? message.id ?? "");
  if (!mid) return null;
  const text = String(message.text ?? "");
  const sender = (evt.sender ?? {}) as { id?: string };
  return {
    canal,
    externalThreadId: String(sender.id ?? "unknown"),
    externalMessageId: mid,
    texto: text,
    recibidoEn: new Date(Number(evt.timestamp ?? Date.now())).toISOString(),
    perfilCanal: {
      nombre: null,
      psid: sender.id ?? null,
      waId: null,
    },
    adjuntos: normalizeMetaAttachments(message.attachments),
    meta: { rawEvent: "meta" },
  };
}

type WaContact = {
  wa_id?: string;
  profile?: { name?: string };
};

function fromWhatsAppCloud(value: Record<string, unknown>): InboundMessage[] {
  const messages = Array.isArray(value.messages) ? value.messages : [];
  if (messages.length === 0) return [];
  const contacts: WaContact[] = Array.isArray(value.contacts)
    ? (value.contacts as WaContact[])
    : [];
  const out: InboundMessage[] = [];

  for (const raw of messages) {
    const message = raw as Record<string, unknown>;
    const mid = String(message.id ?? "").trim();
    if (!mid) continue;
    const from = String(message.from ?? "").trim();
    const thread = whatsAppThread(from);
    if (!thread) continue;
    const contact = contacts.find((c) => String(c.wa_id ?? "") === from);
    const waId = String(contact?.wa_id ?? from).trim();
    const nombre = contact?.profile?.name?.trim() || null;
    const { texto, buttonPayload } = whatsAppText(message);
    out.push({
      canal: "whatsapp",
      externalThreadId: thread,
      externalMessageId: mid,
      texto,
      recibidoEn: whatsAppReceivedAt(message.timestamp),
      perfilCanal: {
        nombre,
        psid: null,
        waId: waId || null,
      },
      ...(buttonPayload ? { buttonPayload } : {}),
      meta: { rawEvent: "whatsapp" },
    });
  }
  return out;
}

function whatsAppThread(from: string): string | null {
  if (!from) return null;
  return `wa:${normalizeTelefono(from) ?? from}`;
}

function whatsAppReceivedAt(raw: unknown): string {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return new Date().toISOString();
  const ms = n < 1e12 ? n * 1000 : n;
  return new Date(ms).toISOString();
}

function whatsAppText(message: Record<string, unknown>): {
  texto: string;
  buttonPayload?: string;
} {
  const text = message.text;
  if (text && typeof text === "object" && "body" in text) {
    const body = String((text as { body?: unknown }).body ?? "").trim();
    if (body) return { texto: body };
  }
  if (typeof text === "string" && text.trim()) return { texto: text.trim() };

  const interactive = message.interactive;
  if (interactive && typeof interactive === "object") {
    const box = interactive as {
      button_reply?: { id?: unknown; title?: unknown };
      list_reply?: { id?: unknown; title?: unknown };
    };
    const reply = box.button_reply ?? box.list_reply;
    if (reply) {
      const title = String(reply.title ?? "").trim();
      const id = String(reply.id ?? "").trim();
      return { texto: title, ...(id ? { buttonPayload: id } : {}) };
    }
  }
  return { texto: "" };
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
