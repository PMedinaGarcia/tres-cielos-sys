import type { CamposCapturados } from "../types";
import {
  formatFechaHumana,
  type HarvestFilledKey,
  type HarvestResult,
} from "./harvest-campos";
import {
  COPY_V2_B1,
  COPY_V2_FECHA_ANOTADA,
  COPY_V2_FECHA_CON_NOMBRE,
  COPY_V2_FECHA_PASADA,
  COPY_V2_FECHA_RETRY,
  COPY_V2_FECHA_SIN_ANIO,
  COPY_V2_NOMBRE_ONLY,
  COPY_V2_NOMBRE_RETRY,
} from "./script-v2.copy";

export type NombreFechaGap = "ambos" | "nombre" | "fecha" | "completo";

export function gapNombreFecha(campos: CamposCapturados): NombreFechaGap {
  const nombre = Boolean(campos.nombre);
  const fecha = Boolean(campos.fechaTentativa);
  if (nombre && fecha) return "completo";
  if (!nombre && !fecha) return "ambos";
  if (!nombre) return "nombre";
  return "fecha";
}

export function huboProgresoCaptura(
  filled: HarvestFilledKey[],
  camposPrevios: CamposCapturados,
): boolean {
  if (filled.includes("nombre") && !camposPrevios.nombre) return true;
  if (filled.includes("fechaTentativa") && !camposPrevios.fechaTentativa) {
    return true;
  }
  return false;
}

export function siguienteNumeroMensajesCaptura(
  prev: number,
  filled: HarvestFilledKey[],
  camposPrevios: CamposCapturados,
): number {
  if (huboProgresoCaptura(filled, camposPrevios)) return 0;
  return prev + 1;
}

export function copyNombreFecha(
  campos: CamposCapturados,
  harvest: Pick<HarvestResult, "fechaMotivo">,
): string {
  const gap = gapNombreFecha(campos);
  const motivo = harvest.fechaMotivo;

  if (
    !campos.fechaTentativa &&
    (motivo === "sin_anio" || motivo === "pasada")
  ) {
    const repair =
      motivo === "pasada" ? COPY_V2_FECHA_PASADA : COPY_V2_FECHA_SIN_ANIO;
    if (campos.nombre) return `Gracias, ${campos.nombre}. ${repair}`;
    return repair;
  }

  if (gap === "nombre") {
    const fecha = formatFechaHumana(campos.fechaTentativa ?? null);
    return fecha ? COPY_V2_FECHA_ANOTADA(fecha) : COPY_V2_NOMBRE_ONLY;
  }
  if (gap === "fecha") {
    return campos.nombre
      ? COPY_V2_FECHA_CON_NOMBRE(campos.nombre)
      : COPY_V2_FECHA_RETRY;
  }
  if (gap === "ambos") {
    return (campos.numeroMensajesCaptura ?? 0) > 0
      ? COPY_V2_NOMBRE_RETRY
      : COPY_V2_B1;
  }
  return COPY_V2_B1;
}
