import {
  TWILIO_WHATSAPP_MEDIA_MAX_BYTES,
  guionWhatsappLinkUrl,
} from "@tres-cielos/shared";

const MIME_IMAGEN = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const MIME_VIDEO = new Set([
  "video/mp4",
  "video/quicktime",
  "video/3gpp",
  "video/mpeg",
]);

/** MIME permitidos en salida asesor ? WhatsApp. */
export function mimePermitidoBandeja(mime: string): boolean {
  const m = mime.toLowerCase().split(";")[0]?.trim() ?? "";
  if (MIME_IMAGEN.has(m) || MIME_VIDEO.has(m)) return true;
  if (m === "application/pdf") return true;
  if (m.startsWith("image/") || m.startsWith("video/")) return true;
  if (
    m === "application/vnd.ms-excel" ||
    m === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return true;
  }
  if (
    m === "application/vnd.ms-powerpoint" ||
    m === "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  ) {
    return true;
  }
  if (m === "application/msword" || m.startsWith("application/vnd.openxmlformats")) {
    return true;
  }
  if (m === "text/plain" || m === "application/zip") return true;
  return false;
}

export type EntregaTwilioMedia = "media" | "link";

export function entregaTwilioParaAdjunto(input: {
  mimeType: string;
  bytes: number;
}): EntregaTwilioMedia {
  if (input.bytes > TWILIO_WHATSAPP_MEDIA_MAX_BYTES) return "link";
  const mime = input.mimeType.toLowerCase();
  if (MIME_IMAGEN.has(mime) || MIME_VIDEO.has(mime)) return "media";
  if (mime === "application/pdf" && input.bytes <= TWILIO_WHATSAPP_MEDIA_MAX_BYTES) {
    return "media";
  }
  if (input.bytes <= TWILIO_WHATSAPP_MEDIA_MAX_BYTES) return "media";
  return "link";
}

export function cuerpoEnlaceAdjunto(nombre: string, url: string): string {
  return `${nombre.trim()}\n${guionWhatsappLinkUrl(url)}`;
}
