/** Normalise un numéro WhatsApp (chiffres, avec indicatif si possible). */
export function normalizeWhatsAppPhone(raw: string): string {
  let digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 8) digits = `228${digits}`;
  if (digits.length === 9 && digits.startsWith("7")) digits = `221${digits}`;
  return digits;
}

export function isValidWhatsAppPhone(raw: string): boolean {
  const digits = normalizeWhatsAppPhone(raw);
  return digits.length >= 10 && digits.length <= 15;
}

export function whatsappFromUser(user?: {
  phone?: string | null;
  user_metadata?: Record<string, unknown> | null;
} | null): string {
  if (!user) return "";
  const meta = user.user_metadata || {};
  const fromMeta = String(meta.whatsapp || meta.phone || "").trim();
  return normalizeWhatsAppPhone(fromMeta || user.phone || "");
}
