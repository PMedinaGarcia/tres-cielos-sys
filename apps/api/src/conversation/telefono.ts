/** Teléfono del canal (WhatsApp waId o hilo `wa:+52…`). */

export function resolveTelefonoCanal(input: {
  waId?: string | null;
  externalThreadId?: string | null;
}): string | null {
  const fromWa = normalizeTelefono(input.waId);
  if (fromWa) return fromWa;
  const thread = input.externalThreadId?.trim() ?? "";
  const m = thread.match(/^wa:(.+)$/i);
  if (m) return normalizeTelefono(m[1]);
  return null;
}

export function normalizeTelefono(raw?: string | null): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/^whatsapp:/i, "").trim();
  if (!cleaned) return null;
  if (!/[0-9]/.test(cleaned)) return null;
  return cleaned;
}
