import { lookup } from "dns/promises";
import { randomBytes } from "crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "fs";
import { isIP } from "net";
import { tmpdir } from "os";
import { join } from "path";
import {
  GUION_PAQUETE_CARD_SLUGS,
  type GuionPaqueteCardSlug,
  type WaContent,
  type WaDocument,
  type WaImage,
} from "@tres-cielos/shared";
import { publicApiBaseUrl } from "./guion-assets";

/** WhatsApp muestra el nombre del archivo como pie si la URL o el Body lo traen. */
export const IMAGE_INLINE_DISPOSITION = "inline";

const IMAGE_EXT = /\.(png|jpe?g|webp|gif)$/i;
const CARD_PATH =
  /^\/public\/guion\/cards\/([a-z0-9-]+)\.(?:png|jpe?g|webp|gif|svg)$/i;
const CLEAN_CARD_PATH = /^\/public\/guion\/i\/([a-z0-9-]+)$/;
const CLEAN_RELAY_PATH = /^\/public\/wa-img\/([a-f0-9]{32})$/;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const RELAY_TTL_MS = 15 * 60 * 1000;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

type RelayedImage = {
  body: Buffer;
  contentType: string;
  expiresAt: number;
};

const relayed = new Map<string, RelayedImage>();
const RELAY_DIR = join(tmpdir(), "tres-cielos-wa-img");

export function isImageFileName(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    return IMAGE_EXT.test(new URL(trimmed).pathname);
  } catch {
    const path = trimmed.split(/[?#]/)[0] ?? "";
    return IMAGE_EXT.test(path);
  }
}

/**
 * La card pública pasa a una ruta sin extensión ni nombre de archivo.
 * Twilio descarga esa URL y WhatsApp ya no tiene texto que mostrar debajo.
 */
export function inlineGuionCardUrl(raw: string): string | undefined {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return undefined;
  }
  const match = url.pathname.match(CARD_PATH);
  const slug = match?.[1];
  if (!slug || !isCardSlug(slug)) return undefined;
  url.pathname = `/public/guion/i/${slug}`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

export function isCleanImageDeliveryUrl(raw: string): boolean {
  try {
    const url = new URL(raw.trim());
    const card = url.pathname.match(CLEAN_CARD_PATH);
    if (card?.[1] && isCardSlug(card[1])) return true;
    return CLEAN_RELAY_PATH.test(url.pathname);
  } catch {
    return false;
  }
}

/** URL que se puede mandar a Twilio sin que el nombre del archivo se vea. */
export function acceptImageMediaUrl(raw: string): string | undefined {
  const inline = inlineGuionCardUrl(raw);
  if (inline) return inline;
  if (!isCleanImageDeliveryUrl(raw)) return undefined;
  const url = new URL(raw.trim());
  url.search = "";
  url.hash = "";
  return url.toString();
}

export function isBlockedAddress(address: string): boolean {
  const normalized = address.toLowerCase().replace(/^::ffff:/, "");
  if (normalized === "::1" || normalized === "0:0:0:0:0:0:0:1") return true;
  if (normalized.startsWith("fe80:") || normalized.startsWith("fc") || normalized.startsWith("fd")) {
    return true;
  }
  const parts = normalized.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return false;
  }
  const a = parts[0]!;
  const b = parts[1]!;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

export async function toFilenameFreeImageUrl(raw: string): Promise<string | undefined> {
  const url = raw.trim();
  if (!url) return undefined;
  const inline = inlineGuionCardUrl(url);
  if (inline) return inline;
  if (isCleanImageDeliveryUrl(url)) return acceptImageMediaUrl(url);
  if (!isImageFileName(url)) return undefined;
  try {
    return await relayRemoteImage(url);
  } catch {
    return undefined;
  }
}

export function countOutboundImages(wa: WaContent | undefined): number {
  if (!wa) return 0;
  const docs = wa.documents?.length ? wa.documents : wa.document ? [wa.document] : [];
  const fromDocs = docs.filter(
    (doc) => isImageFileName(doc.filename) || isImageFileName(doc.url),
  ).length;
  const fromImages = (wa.images ?? []).filter((image) => image.url.trim()).length;
  return fromDocs + fromImages;
}

export async function prepareOutboundImages(wa: WaContent): Promise<WaContent> {
  const sourceDocs: WaDocument[] = wa.documents?.length
    ? wa.documents
    : wa.document
      ? [wa.document]
      : [];
  const imageUrls: string[] = [];
  const documents: WaDocument[] = [];
  for (const doc of sourceDocs) {
    if (isImageFileName(doc.filename) || isImageFileName(doc.url)) {
      imageUrls.push(doc.url);
      continue;
    }
    documents.push(doc);
  }
  for (const image of wa.images ?? []) {
    if (image.url.trim()) imageUrls.push(image.url.trim());
  }
  const images: WaImage[] = [];
  for (const url of imageUrls) {
    const clean = await toFilenameFreeImageUrl(url);
    if (clean) images.push({ url: clean });
  }
  return {
    ...wa,
    ...(documents.length
      ? { documents, document: documents[0] }
      : { documents: undefined, document: undefined }),
    ...(images.length ? { images } : { images: undefined }),
  };
}

export function readRelayedImage(
  id: string,
): { body: Buffer; contentType: string } | undefined {
  if (!/^[a-f0-9]{32}$/.test(id)) return undefined;
  const hit = relayed.get(id);
  if (hit && hit.expiresAt > Date.now()) {
    return { body: hit.body, contentType: hit.contentType };
  }
  relayed.delete(id);
  return readRelayedImageFromDisk(id);
}

export function clearRelayedImages(): void {
  relayed.clear();
  rmSync(RELAY_DIR, { recursive: true, force: true });
}

async function relayRemoteImage(raw: string): Promise<string> {
  const target = await assertFetchableImageUrl(raw);
  const res = await fetch(target.toString(), {
    redirect: "manual",
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status >= 300 && res.status < 400) {
    throw new Error("redirect");
  }
  if (!res.ok) throw new Error(`status ${res.status}`);
  const contentType = normalizeImageType(res.headers.get("content-type"));
  if (!contentType) throw new Error("content-type");
  const body = await readLimited(res);
  if (!imageMagicOk(contentType, body)) throw new Error("magic");
  pruneRelay();
  const id = randomBytes(16).toString("hex");
  const expiresAt = Date.now() + RELAY_TTL_MS;
  relayed.set(id, { body, contentType, expiresAt });
  persistRelayedImage(id, body, contentType);
  return `${publicApiBaseUrl()}/public/wa-img/${id}`;
}

function persistRelayedImage(id: string, body: Buffer, contentType: string): void {
  mkdirSync(RELAY_DIR, { recursive: true });
  writeFileSync(join(RELAY_DIR, id), body);
  writeFileSync(join(RELAY_DIR, `${id}.type`), contentType);
}

function readRelayedImageFromDisk(
  id: string,
): { body: Buffer; contentType: string } | undefined {
  const path = join(RELAY_DIR, id);
  const typePath = join(RELAY_DIR, `${id}.type`);
  if (!existsSync(path) || !existsSync(typePath)) return undefined;
  const age = Date.now() - statSync(path).mtimeMs;
  if (age > RELAY_TTL_MS) {
    rmSync(path, { force: true });
    rmSync(typePath, { force: true });
    return undefined;
  }
  const contentType = readFileSync(typePath, "utf8").trim();
  if (!contentType.startsWith("image/")) return undefined;
  return { body: readFileSync(path), contentType };
}

async function assertFetchableImageUrl(raw: string): Promise<URL> {
  const url = new URL(raw);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("protocol");
  }
  if (url.username || url.password) throw new Error("auth");
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "metadata.google.internal" ||
    host === "metadata.internal"
  ) {
    throw new Error("host");
  }
  const addresses = isIP(host)
    ? [host]
    : (await lookup(host, { all: true })).map((entry) => entry.address);
  if (addresses.length === 0 || addresses.some((address) => isBlockedAddress(address))) {
    throw new Error("address");
  }
  return url;
}

function normalizeImageType(header: string | null): string | undefined {
  const type = header?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!ALLOWED_TYPES.has(type)) return undefined;
  return type === "image/jpg" ? "image/jpeg" : type;
}

async function readLimited(res: Response): Promise<Buffer> {
  const declared = Number(res.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_IMAGE_BYTES) {
    throw new Error("size");
  }
  if (!res.body) {
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_IMAGE_BYTES) throw new Error("size");
    return buf;
  }
  const reader = res.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_IMAGE_BYTES) {
      await reader.cancel();
      throw new Error("size");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

function imageMagicOk(contentType: string, body: Buffer): boolean {
  if (body.length < 12) return false;
  if (contentType === "image/png") {
    return body.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (contentType === "image/jpeg") {
    return body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff;
  }
  return (
    body.subarray(0, 4).toString("ascii") === "RIFF" &&
    body.subarray(8, 12).toString("ascii") === "WEBP"
  );
}

function pruneRelay(): void {
  const now = Date.now();
  for (const [id, image] of relayed) {
    if (image.expiresAt <= now) relayed.delete(id);
  }
  while (relayed.size > 40) {
    const oldest = relayed.keys().next().value;
    if (!oldest) break;
    relayed.delete(oldest);
  }
}

function isCardSlug(slug: string): slug is GuionPaqueteCardSlug {
  return (GUION_PAQUETE_CARD_SLUGS as readonly string[]).includes(slug);
}
