/** N'accepte que les pages de paiement PayDunya en HTTPS. */
export function paydunyaCheckoutUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  if (host !== "paydunya.com" && !host.endsWith(".paydunya.com")) return null;
  return url.toString();
}

/** Texte d'erreur PayDunya, sans adresse web. */
export function paydunyaProviderMessage(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const text = value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 180);
  if (!text || /https?:|javascript:|data:/i.test(text)) return fallback;
  return text;
}
