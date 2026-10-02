import { existsSync } from "fs";
import { join } from "path";
import {
  GUION_FLUJO_PDFS,
  GUION_PAQUETE_CARD_EXTENSION,
  GUION_PDF_FILENAME,
  GUION_PDF_PUBLIC_PATH,
  type WaDocument,
} from "@tres-cielos/shared";

export const PAQUETE_BODAS_PDF_RELATIVE = join(
  "assets",
  "guion",
  "paquete-bodas-2027.pdf",
);

export function publicApiBaseUrl(): string {
  const fromEnv = process.env.PUBLIC_API_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const port = process.env.PORT ?? "3011";
  return `http://localhost:${port}`;
}

export function paqueteBodas2027Document(): WaDocument {
  return {
    filename: GUION_PDF_FILENAME,
    mime: "application/pdf",
    url: `${publicApiBaseUrl()}${GUION_PDF_PUBLIC_PATH}`,
  };
}

/** Los dos PDF que el guion comparte. Sin fotos. */
export function guionFlujoDocuments(): WaDocument[] {
  const base = publicApiBaseUrl();
  return GUION_FLUJO_PDFS.map((pdf) => ({
    filename: pdf.filename,
    mime: "application/pdf" as const,
    url: `${base}${pdf.publicPath}`,
  }));
}

export function resolvePaqueteCardPath(slug: string): string {
  const dir = join(process.cwd(), "assets", "guion", "cards");
  const primary = join(dir, `${slug}.${GUION_PAQUETE_CARD_EXTENSION}`);
  if (existsSync(primary)) return primary;
  const legacySvg = join(dir, `${slug}.svg`);
  if (existsSync(legacySvg)) return legacySvg;
  return primary;
}

export function paqueteCardContentType(path: string): string {
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".png")) return "image/png";
  return "application/octet-stream";
}

export function resolvePaqueteBodasPdfPath(): string {
  return join(process.cwd(), PAQUETE_BODAS_PDF_RELATIVE);
}

export function paqueteBodasPdfExists(): boolean {
  return existsSync(resolvePaqueteBodasPdfPath());
}
