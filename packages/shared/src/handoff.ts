import { z } from "zod";

/**
 * MotivoHandoff — enum cerrado (Fase A5).
 * Incluye motivos de docs/backend/05 + media/IA del plan chatbot.
 */
export const MotivoHandoffSchema = z.enum([
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
]);

export type MotivoHandoff = z.infer<typeof MotivoHandoffSchema>;

export const MOTIVO_HANDOFF_VALUES = MotivoHandoffSchema.options;
