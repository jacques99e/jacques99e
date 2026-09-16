import { openShareLink } from "@/lib/open-share";

export function buildWhatsAppShareUrl(text: string, phone?: string): string {
  const encoded = encodeURIComponent(text.trim());
  if (phone) {
    return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encoded}`;
  }
  return `https://api.whatsapp.com/send?text=${encoded}`;
}

export function openWhatsAppShare(text: string, phone?: string) {
  openShareLink(buildWhatsAppShareUrl(text, phone));
}
