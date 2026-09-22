import { isAndroidUserAgent, isStandaloneDisplay, openShareLink } from "@/lib/open-share";

export function buildWhatsAppShareUrl(text: string, phone?: string): string {
  const encoded = encodeURIComponent(text.trim());
  const digits = phone?.replace(/\D/g, "") || "";
  if (digits) return `https://wa.me/${digits}?text=${encoded}`;
  return `https://wa.me/?text=${encoded}`;
}

function buildWhatsAppSchemeUrl(text: string, phone?: string): string {
  const encoded = encodeURIComponent(text.trim());
  const digits = phone?.replace(/\D/g, "") || "";
  if (digits) return `whatsapp://send?phone=${digits}&text=${encoded}`;
  return `whatsapp://send?text=${encoded}`;
}

/** Ouvre WhatsApp tout de suite — pas le menu de partage du téléphone. */
export function openWhatsAppShare(text: string, phone?: string) {
  const body = text.trim();
  if (!body) return;
  const href = buildWhatsAppShareUrl(body, phone);

  if (isStandaloneDisplay() && isAndroidUserAgent()) {
    window.location.assign(buildWhatsAppSchemeUrl(body, phone));
    window.setTimeout(() => {
      if (document.visibilityState === "visible") window.location.assign(href);
    }, 500);
    return;
  }

  openShareLink(href);
}
