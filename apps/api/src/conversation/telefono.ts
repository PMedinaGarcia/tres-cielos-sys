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
  return normalizeTelefono(thread);
}

export function phoneDigits(raw?: string | null): string | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/^whatsapp:/i, "")
    .replace(/^wa:/i, "")
    .trim();
  if (!cleaned) return null;
  const digits = cleaned.replace(/\D/g, "");
  return digits.length ? digits : null;
}

/**
 * Huella MX: 10 dígitos nacionales.
 * Cubre `+52` (12), `+521` móvil (13) y local (10).
 */
export function phoneFingerprint(raw?: string | null): string | null {
  let digits = phoneDigits(raw);
  if (!digits) return null;
  if (digits.startsWith("52") && digits.length >= 12) {
    digits = digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    digits = digits.slice(1);
  }
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

export function phoneMatchVariants(fingerprint: string): string[] {
  const fp = fingerprint.replace(/\D/g, "");
  if (!fp) return [];
  return [...new Set([fp, `+52${fp}`, `+521${fp}`, `52${fp}`, `521${fp}`])];
}

export function normalizeTelefono(raw?: string | null): string | null {
  const fp = phoneFingerprint(raw);
  if (!fp) return null;
  if (fp.length === 10) return `+52${fp}`;
  return `+${fp}`;
}
