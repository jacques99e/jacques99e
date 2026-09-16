import { openShareLink } from "@/lib/open-share";

function isMobileShare(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent);
}

/** Sharer Facebook : l’aperçu (titre, photo, lien) vient des balises Open Graph de l’URL. */
export function buildFacebookShareUrl(url: string, quote?: string, mobile = false): string {
  const share = new URL(
    mobile
      ? "https://m.facebook.com/sharer.php"
      : "https://www.facebook.com/sharer/sharer.php"
  );
  share.searchParams.set("u", url);
  const text = quote?.replace(/[\r\n\t]+/g, " ").trim();
  if (text) share.searchParams.set("quote", text.slice(0, 500));
  return share.toString();
}

export function openFacebookShare(url: string, quote?: string) {
  if (!url) return;
  const href = buildFacebookShareUrl(url, quote, isMobileShare());
  if (isMobileShare()) {
    openShareLink(href);
    return;
  }
  const popup = window.open(
    href,
    "wazo_fb_share",
    "width=640,height=720,scrollbars=yes,noopener,noreferrer"
  );
  if (!popup) openShareLink(href);
}
