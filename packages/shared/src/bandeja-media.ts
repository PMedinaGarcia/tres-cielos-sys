import { z } from "zod";

/** Límite por archivo en bandeja (asesor ? cliente). */
export const BANDEJA_ADJUNTO_MAX_BYTES = 25 * 1024 * 1024 * 1024;

/** Twilio / WhatsApp: media directo (MediaUrl). */
export const TWILIO_WHATSAPP_MEDIA_MAX_BYTES = 16 * 1024 * 1024;

/** AWS S3: PUT simple (multipart obligatorio por encima). */
export const S3_SINGLE_PUT_MAX_BYTES = 5 * 1024 * 1024 * 1024;

export const PrepararAdjuntoBandejaRequestSchema = z.object({
  nombreOriginal: z.string().trim().min(1).max(512),
  mimeType: z.string().trim().min(3).max(128),
  bytes: z.number().int().min(1).max(BANDEJA_ADJUNTO_MAX_BYTES),
});
export type PrepararAdjuntoBandejaRequest = z.infer<
  typeof PrepararAdjuntoBandejaRequestSchema
>;

export const PrepararAdjuntoBandejaResponseSchema = z.object({
  uploadId: z.string(),
  storageKey: z.string(),
  method: z.enum(["put", "multipart"]),
  uploadUrl: z.string().optional(),
  multipart: z
    .object({
      uploadIdS3: z.string(),
      partSize: z.number().int(),
      partUrls: z.array(z.string()),
    })
    .optional(),
  expiresEn: z.string(),
});
export type PrepararAdjuntoBandejaResponse = z.infer<
  typeof PrepararAdjuntoBandejaResponseSchema
>;

export const CompletarMultipartRequestSchema = z.object({
  parts: z.array(
    z.object({
      partNumber: z.number().int().min(1).max(10_000),
      etag: z.string().min(1),
    }),
  ),
});
export type CompletarMultipartRequest = z.infer<
  typeof CompletarMultipartRequestSchema
>;

export const CompletarAdjuntoBandejaResponseSchema = z.object({
  uploadId: z.string(),
  storageKey: z.string(),
  mimeType: z.string(),
  nombreOriginal: z.string(),
  bytes: z.number().int(),
});
export type CompletarAdjuntoBandejaResponse = z.infer<
  typeof CompletarAdjuntoBandejaResponseSchema
>;

export const MensajeAsesorAdjuntoRefSchema = z.object({
  uploadId: z.string().min(1),
});
export type MensajeAsesorAdjuntoRef = z.infer<
  typeof MensajeAsesorAdjuntoRefSchema
>;
