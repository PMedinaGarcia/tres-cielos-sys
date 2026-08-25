/** Utilidades de cita tipada `[Fuente: nombre | tipo: tipo_material]`. */
import { CITA_REGEX, CitaTipada } from "./types";

export function extractCita(texto: string): CitaTipada | null {
  const m = texto.match(CITA_REGEX);
  if (!m) return null;
  return {
    nombreArchivo: m[1]!.trim(),
    tipoMaterial: m[2]!.trim(),
    raw: m[0],
  };
}

export function hasCitaTipada(texto: string): boolean {
  return extractCita(texto) != null;
}

export function formatCita(nombreArchivo: string, tipoMaterial: string): string {
  return `[Fuente: ${nombreArchivo} | tipo: ${tipoMaterial}]`;
}

/**
 * Valida que la cita del modelo coincida con alguno de los fragmentos
 * enviados al LLM (nombre + tipo).
 */
export function citaCoincideConFragmentos(
  cita: CitaTipada,
  fragmentos: Array<{ nombreArchivoCita: string; tipoMaterial: string }>,
): boolean {
  const nombre = cita.nombreArchivo.toLowerCase();
  const tipo = cita.tipoMaterial.toLowerCase();
  return fragmentos.some(
    (f) =>
      f.nombreArchivoCita.toLowerCase() === nombre &&
      f.tipoMaterial.toLowerCase() === tipo,
  );
}
