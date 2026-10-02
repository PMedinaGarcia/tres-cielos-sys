/** Identidad operativa de la sede única (Tres Cielos Tequesquitengo). */

export const SEDE_ID = "sede-tequesquitengo";
export const SEDE_NOMBRE = "Tres Cielos Tequesquitengo";
/** Slug de `Paquete.sede` en catálogo (no el display name). */
export const SEDE_SLUG = "tequesquitengo";

/** Dirección postal autorizada (K02). Sin pin GPS ni Maps/Waze. */
export const SEDE_DIRECCION =
  "Lago de Teques Lote 36, 4ª sección, CP 62915, Tequesquitengo, Jojutla, Morelos";
export const SEDE_REFERENCIA_VIAL = "Bajada 6 hasta el fondo";

/** Una línea para el guion de cotización y copy de catálogo. */
export function copySedeUbicacionCorta(): string {
  return `${SEDE_NOMBRE}, en ${SEDE_DIRECCION} (${SEDE_REFERENCIA_VIAL})`;
}

/** Normaliza nombre humano o slug a la clave de `Paquete.sede`. */
export function sedeToCatalogSlug(
  value: string | null | undefined,
): string | undefined {
  if (value == null) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const lower = trimmed.toLowerCase();
  if (lower === SEDE_SLUG) return SEDE_SLUG;
  if (
    lower.includes("tequesquitengo") ||
    lower.includes("tres cielos") ||
    lower.includes("jardin") ||
    lower.includes("jardín")
  ) {
    return SEDE_SLUG;
  }
  return trimmed;
}

export const GUION_ADJUNTO_PAQUETE_BODAS = "paquete-bodas-2027" as const;
export type GuionAdjuntoId = typeof GUION_ADJUNTO_PAQUETE_BODAS;

/**
 * PDF que el guion comparte, en este orden.
 * WhatsApp vía Twilio rechaza documentos de más de 16 MB.
 * El de experiencia pesa ~23 MB, así que viaja como enlace.
 */
export const GUION_FLUJO_PDFS = [
  {
    slug: "experiencia-boda-tres-dias-2027",
    filename: "Experiencia boda de tres días - 2027.pdf",
    publicPath: "/public/guion/experiencia-boda-tres-dias-2027.pdf",
    delivery: "link",
  },
  {
    slug: "tarifas-2027-tres-cielos",
    filename: "Tarifas 2027 - Tres Cielos.pdf",
    publicPath: "/public/guion/tarifas-2027-tres-cielos.pdf",
    delivery: "media",
  },
] as const;

export type GuionFlujoPdf = (typeof GUION_FLUJO_PDFS)[number];
export type GuionFlujoPdfSlug = GuionFlujoPdf["slug"];

export const GUION_PDF_PUBLIC_PATH = "/public/guion/paquete-bodas-2027.pdf";
export const GUION_PDF_FILENAME = "Tres Cielos Paquete Bodas 2027.pdf";
