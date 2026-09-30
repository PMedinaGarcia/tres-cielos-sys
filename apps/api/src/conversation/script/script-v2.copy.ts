import { ejemploFechaTarifaPublicada } from "@tres-cielos/shared";
import { accionHandoffLabel } from "../conversation-flow";
import type { CamposCapturados } from "../types";

const { humana: EJEMPLO_FECHA, dmy: EJEMPLO_FECHA_DMY } =
  ejemploFechaTarifaPublicada();

export const COPY_V2_B1 =
  "¡Hola! Soy el asistente de Tres Cielos. Para ayudarles con su boda, ¿me compartes tu nombre y la fecha o temporada que tienen en mente? Si se trata de otro tipo de evento, dime y lo ajusto.";

export const COPY_V2_B2 = (nombre: string): string =>
  `Gracias, ${nombre}. Para orientarte correctamente, ¿qué escenario consideran más viable: $250–349 mil, $350–499 mil, $500 mil o más, o aún lo están definiendo?`;

export const COPY_V2_B2_SIN_NOMBRE =
  "Para orientarte correctamente, ¿qué escenario consideran más viable: $250–349 mil, $350–499 mil, $500 mil o más, o aún lo están definiendo?";

export const COPY_V2_B3 =
  "Sin problema. Nuestras bodas parten aproximadamente de $250,000 MXN. ¿Se sentirían cómodos considerando ese punto de partida?";

export const COPY_V2_MENOR_PISO =
  "Gracias por compartirlo. Revisaremos si existe una opción vigente cercana a su inversión.";

export function copyMenorPisoConAlternativa(nombre: string): string {
  return `${COPY_V2_MENOR_PISO} Opción vigente cercana: ${nombre}.`;
}

export function copyMenorPisoConPisoPublicado(nombre: string): string {
  return `${COPY_V2_MENOR_PISO} El piso publicado es el ${nombre}.`;
}

export const COPY_V2_NUTRICION_HOLD =
  "Conservamos tu solicitud. Si quieres conocer el piso publicado o hablar con un asesor, retomo por este medio.";

export const COPY_PISO_VISITA =
  "Perfecto. El siguiente paso es conocer el jardín. Un asesor te contacta para confirmar horario.";

export const COPY_NUTRICION_T24_INMEDIATO =
  "Sin problema. Te escribo por este medio en 24 horas para continuar.";

export const COPY_V2_NUTRICION_EVASION =
  "Claro. Conservamos tu solicitud y, cuando tengan fecha, aforo o rango definido, retomamos la propuesta por este medio.";

export const COPY_V2_SEGUIMIENTO =
  "Entendido. Conservamos tus datos y puedes preguntarme por el venue o las políticas; si más adelante quieren cotizar o visitar, aquí estaré.";

export function copyV2Handoff(campos: CamposCapturados): string {
  const accion = accionHandoffLabel(campos);
  if (campos.nombre) {
    return `Perfecto, ${campos.nombre}. Ya tengo lo esencial de su boda; te conecto con un asesor para ${accion} (ventana estimada 15–30 min).`;
  }
  return `Perfecto. Ya tengo lo esencial de su boda; te conecto con un asesor para ${accion} (ventana estimada 15–30 min).`;
}

export const COPY_V2_NOMBRE_RETRY =
  "Para continuar, ¿me compartes tu nombre y la fecha o temporada que tienen en mente?";

export const COPY_V2_NOMBRE_ONLY = "¿Me compartes tu nombre?";

export const COPY_V2_FECHA_ANOTADA = (fecha: string): string =>
  `Anoté ${fecha}. ¿Me compartes tu nombre?`;

export const COPY_V2_FECHA_RETRY =
  "¿Qué fecha o temporada tienen en mente? Necesito al menos mes y año, o un día concreto.";

export const COPY_V2_FECHA_CON_NOMBRE = (nombre: string): string =>
  `Gracias, ${nombre}. ${COPY_V2_FECHA_RETRY}`;

export const COPY_V2_FECHA_SIN_ANIO =
  `Necesito al menos mes y año. Por ejemplo: febrero 2027 o ${EJEMPLO_FECHA}.`;

export const COPY_V2_FECHA_NO_INTERPRETADA =
  `No alcancé a interpretar la fecha. Indica día, mes y año, por ejemplo ${EJEMPLO_FECHA} o ${EJEMPLO_FECHA_DMY}.`;

export const COPY_V2_FECHA_PASADA =
  `Esa fecha ya pasó. Indica un día, mes y año vigentes, por ejemplo ${EJEMPLO_FECHA}.`;

export const COPY_V2_AFORO_RETRY =
  "¿Para cuántas personas sería aproximadamente? Indica un número entero, por ejemplo 150 o 150 invitados.";

export const COPY_V3_B2_AFORO = (nombre: string): string =>
  `Gracias, ${nombre}. ¿Para cuántas personas sería aproximadamente?`;

export const COPY_V3_B2_AFORO_SIN_NOMBRE =
  "¿Para cuántas personas sería aproximadamente?";

export const COPY_V3_B2_RANGO = (nombre: string): string =>
  `Gracias, ${nombre}. Para orientarte correctamente, ¿qué escenario consideran más viable: $250–349 mil, $350–499 mil, $500 mil o más, o aún lo están definiendo?`;

export const COPY_V3_B2_RANGO_SIN_NOMBRE =
  "Para orientarte correctamente, ¿qué escenario consideran más viable: $250–349 mil, $350–499 mil, $500 mil o más, o aún lo están definiendo?";

export const COPY_V3_CIERRE_VISITA = (nombre?: string | null): string => {
  const saludo = nombre ? `Perfecto, ${nombre}.` : "Perfecto.";
  return `${saludo} Ya tengo lo esencial. El siguiente paso es visitar el jardín; un asesor te confirma horario en 15–30 min. Cotizar no aparta fecha.`;
};

export const COPY_V3_VALOR_INLINE =
  "Cada boda la diseñamos según invitados, fecha y producción; las experiencias parten aproximadamente de $250,000 MXN.";

export const COPY_V3_FECHA_MINIMA =
  "La anticipación de contratación depende de la temporada y el cupo del jardín. Un asesor te confirma el plazo en la visita; no hace falta escalar por esta duda.";

export const COPY_V3_ADJUNTO_RETRY =
  "Puedo guardar foto o PDF de hasta 25 MB. Si el archivo no pasa, reenvíalo en ese formato.";

export const COPY_V3_RAG_SAFE_VISITA =
  "Eso te lo confirma el asesor en la visita al jardín.";

export const COPY_V3_RAG_SAFE_FAQ =
  "Ese detalle lo confirma el equipo en cuanto tengan fecha y aforo. ¿Seguimos con lo esencial?";

export const COPY_V3_NUTRICION_T24 = (nombre?: string | null): string =>
  `Hola${nombre ? ` ${nombre}` : ""}, aquí Tres Cielos. Cuando tengan fecha, aforo o rango, retomamos la propuesta por este medio.`;

export const COPY_V3_NUTRICION_T7 = (nombre?: string | null): string =>
  `Hola${nombre ? ` ${nombre}` : ""}, te escribo de Tres Cielos. Si ya tienen fecha o un rango cercano a $250,000 MXN, retomo por este medio.`;

export const COPY_V3_HUMANO_TEMPRANO =
  "Con gusto te conecto con el equipo. En breve te atienden (15–30 min).";
