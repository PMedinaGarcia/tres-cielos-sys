/** Identidad operativa de la sede única (Tres Cielos Tequesquitengo). */

export const SEDE_ID = "sede-tequesquitengo";
export const SEDE_NOMBRE = "Tres Cielos Tequesquitengo";
/** Slug de `Paquete.sede` en catálogo (no el display name). */
export const SEDE_SLUG = "tequesquitengo";

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

export const GUION_PDF_PUBLIC_PATH = "/public/guion/paquete-bodas-2027.pdf";
export const GUION_PDF_FILENAME = "Tres Cielos Paquete Bodas 2027.pdf";
