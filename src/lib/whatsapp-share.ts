import {
  canNativeShare,
  isAndroidUserAgent,
  isStandaloneDisplay,
  openNativeShare,
  openShareLink,
} from "@/lib/open-share";

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

export function openWhatsAppShare(text: string, phone?: string) {
  const body = text.trim();
  if (!body) return;
  const href = buildWhatsAppShareUrl(body, phone);

  if (isStandaloneDisplay() && isAndroidUserAgent()) {
    const scheme = buildWhatsAppSchemeUrl(body, phone);
    window.location.assign(scheme);
    window.setTimeout(() => {
      if (document.visibilityState === "visible") {
        window.location.assign(href);
      }
    }, 700);
    return;
  }

  if (canNativeShare() && !phone) {
    void openNativeShare({ text: body }).then((shared) => {
      if (!shared) openShareLink(href);
    });
    return;
  }

  openShareLink(href);
}
