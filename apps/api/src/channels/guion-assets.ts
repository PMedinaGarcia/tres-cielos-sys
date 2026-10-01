import { existsSync } from "fs";
import { join } from "path";
import {
  GUION_PAQUETE_CARD_CAPTIONS,
  GUION_PAQUETE_CARD_SLUGS,
  GUION_PDF_FILENAME,
  GUION_PDF_PUBLIC_PATH,
  guionPaqueteCardUrl,
  type WaDocument,
  type WaImage,
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

export function paqueteBodasGaleria(): WaImage[] {
  const base = publicApiBaseUrl();
  return GUION_PAQUETE_CARD_SLUGS.map((slug) => ({
    url: guionPaqueteCardUrl(slug, base),
    caption: GUION_PAQUETE_CARD_CAPTIONS[slug],
  }));
}

export function resolvePaqueteCardPath(slug: string): string {
  return join(process.cwd(), "assets", "guion", "cards", `${slug}.svg`);
}

export function resolvePaqueteBodasPdfPath(): string {
  return join(process.cwd(), PAQUETE_BODAS_PDF_RELATIVE);
}

export function paqueteBodasPdfExists(): boolean {
  return existsSync(resolvePaqueteBodasPdfPath());
}
