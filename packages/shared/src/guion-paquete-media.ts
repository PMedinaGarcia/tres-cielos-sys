import { publicApiBaseUrlForGuion } from "./guion-public-url";

export const GUION_PAQUETE_CARD_SLUGS = [
  "01-jardin-experiencia",
  "02-paquetes-precios",
  "03-servicios-incluidos",
  "04-capacidad-espacios",
] as const;

export type GuionPaqueteCardSlug = (typeof GUION_PAQUETE_CARD_SLUGS)[number];

export const GUION_PAQUETE_CARD_CAPTIONS: Record<GuionPaqueteCardSlug, string> =
  {
    "01-jardin-experiencia": "Jardín y experiencia Tres Cielos",
    "02-paquetes-precios": "Paquetes y rangos de inversión",
    "03-servicios-incluidos": "Servicios y amenidades incluidas",
    "04-capacidad-espacios": "Capacidad y espacios del venue",
  };

export const GUION_PAQUETE_CARDS_PUBLIC_PREFIX = "/public/guion/cards";

export function guionPaqueteCardUrl(
  slug: GuionPaqueteCardSlug,
  baseUrl?: string,
): string {
  const base = (baseUrl ?? publicApiBaseUrlForGuion()).replace(/\/$/, "");
  return `${base}${GUION_PAQUETE_CARDS_PUBLIC_PREFIX}/${slug}.svg`;
}
