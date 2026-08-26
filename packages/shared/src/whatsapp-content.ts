import { z } from "zod";

/** Payload canónico del CTA de asesor (Twilio ButtonPayload / ListId). */
export const HABLAR_ASESOR_PAYLOAD = "hablar_asesor";

/** Título de botón WhatsApp (máx. 20 caracteres). */
export const HABLAR_ASESOR_TITLE = "Hablar con asesor";

/** Texto inbound que también matchea el regex de pedido humano. */
export const HABLAR_ASESOR_TEXTO = "Hablar con un asesor";

export const WA_BUTTON_TITLE_MAX = 20;
export const WA_LIST_ITEM_TITLE_MAX = 24;
export const WA_QUICK_REPLY_MAX = 3;

export const WaContentKindSchema = z.enum([
  "text",
  "quick-reply",
  "list-picker",
]);
export type WaContentKind = z.infer<typeof WaContentKindSchema>;

export const WaButtonSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(WA_BUTTON_TITLE_MAX),
});
export type WaButton = z.infer<typeof WaButtonSchema>;

export const WaListItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(WA_LIST_ITEM_TITLE_MAX),
  description: z.string().max(72).optional(),
});
export type WaListItem = z.infer<typeof WaListItemSchema>;

export const WaListSchema = z.object({
  button: z.string().min(1).max(WA_BUTTON_TITLE_MAX),
  items: z.array(WaListItemSchema).min(1).max(10),
});
export type WaList = z.infer<typeof WaListSchema>;

export const WaDocumentSchema = z.object({
  filename: z.string().min(1),
  mime: z.literal("application/pdf"),
  url: z.string().min(1),
});
export type WaDocument = z.infer<typeof WaDocumentSchema>;

export const WaContentSchema = z.object({
  templateId: z.string().min(1),
  kind: WaContentKindSchema,
  body: z.string(),
  buttons: z.array(WaButtonSchema).max(WA_QUICK_REPLY_MAX).optional(),
  list: WaListSchema.optional(),
  contentSid: z.string().optional(),
  document: WaDocumentSchema.optional(),
});
export type WaContent = z.infer<typeof WaContentSchema>;
