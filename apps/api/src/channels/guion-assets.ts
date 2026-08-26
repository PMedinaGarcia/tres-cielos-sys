import { existsSync } from "fs";
import { join } from "path";
import {
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

export function resolvePaqueteBodasPdfPath(): string {
  return join(process.cwd(), PAQUETE_BODAS_PDF_RELATIVE);
}

export function paqueteBodasPdfExists(): boolean {
  return existsSync(resolvePaqueteBodasPdfPath());
}
