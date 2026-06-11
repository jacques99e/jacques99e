export function buildWhatsAppShareUrl(text: string, phone?: string): string {
  const base = phone
    ? `https://wa.me/${phone.replace(/\D/g, "")}`
    : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(text)}`;
}
