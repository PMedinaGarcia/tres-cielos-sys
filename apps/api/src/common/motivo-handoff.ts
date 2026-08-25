/**
 * MotivoHandoff — enum cerrado (Fase A5).
 * Incluye motivos documentados en 05/02 + media/IA del plan §4.3 / §10 A5.
 */
export const MOTIVO_HANDOFF_VALUES = [
  "solicitud_usuario",
  "rerank_bajo",
  "sin_catalogo",
  "sin_cita_rag",
  "conflicto",
  "queja",
  "descuento_fuera_catalogo",
  "sede_no_cubierta",
  "ambiguedad",
  "adjunto_no_soportado",
  "material_ocr_tarifas",
  "proveedor_ia",
  "cupo_ia",
  "otro",
] as const;

export type MotivoHandoff = (typeof MOTIVO_HANDOFF_VALUES)[number];

export function isMotivoHandoff(value: string): value is MotivoHandoff {
  return (MOTIVO_HANDOFF_VALUES as readonly string[]).includes(value);
}
