import { anioTarifaPublicada } from "@tres-cielos/shared";

const ANIO_TARIFA = anioTarifaPublicada();

export const COPY_V4_B1 =
  "Gracias por escribirnos ❤️ Si deseas comenzar a planear tu boda con nosotros, ¡cuéntanos qué temporada tienes en mente! Elige una opción de la lista";

export const COPY_V4_B1_RETRY = `Para continuar, elige la temporada de tu evento en la lista: Ene a May ${ANIO_TARIFA}, Jun-Sep ${ANIO_TARIFA}, Oct-Dic ${ANIO_TARIFA} o 2028.`;

export const COPY_V4_NOMBRE = "¡Perfecto! ¿Con quién tenemos el gusto?";

export const COPY_V4_NOMBRE_RETRY = "Para continuar, ¿me compartes tu nombre?";

export const COPY_V4_PDF = (nombre: string): string =>
  `Gracias, ${nombre}. Te comparto dos PDF: la experiencia de boda de tres días y las tarifas ${ANIO_TARIFA}. Cuando los revises, dime cómo prefieres seguir.`;

export const COPY_V4_CTA_RETRY =
  "¿Cómo prefieres seguir? Elige una opción: agendar visita, hablar con un ejecutivo o, si estamos fuera de tu presupuesto, dímelo.";

export const COPY_V4_PRESUPUESTO_FUERA =
  "Gracias por compartirlo. Para orientarte mejor, ¿en qué rango está su presupuesto actual? Elige una opción de la lista.";

export const COPY_V4_PRESUPUESTO_FUERA_RETRY =
  "Elige el rango que más se acerca a su presupuesto: 200-250 mil, 250-300 mil o Fuera de Rango.";

export const COPY_V4_HANDOFF_VISITA = (nombre?: string | null): string =>
  `${nombre ? `Perfecto, ${nombre}.` : "Perfecto."} Un asesor te contacta para agendar tu visita al jardín (15–30 min).`;

export const COPY_V4_HANDOFF_EJECUTIVO = (nombre?: string | null): string =>
  `${nombre ? `Con gusto, ${nombre}.` : "Con gusto."} Te conecto con un ejecutivo; en breve te atiende (15–30 min).`;
