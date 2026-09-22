import { isAndroidUserAgent, isStandaloneDisplay } from "@/lib/open-share";

/** Sharer Facebook : l’aperçu vient des balises Open Graph. */
export function buildFacebookShareUrl(url: string): string {
  const share = new URL("https://www.facebook.com/sharer/sharer.php");
  share.searchParams.set("u", url);
  return share.toString();
}

/** Intent Android : ouvre l’appli Facebook, sinon le site. */
export function buildFacebookShareHref(url: string): string {
  const web = buildFacebookShareUrl(url);
  if (typeof navigator === "undefined" || !/Android/i.test(navigator.userAgent)) {
    return web;
  }
  const path = `www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
  return `intent://${path}#Intent;scheme=https;package=com.facebook.katana;S.browser_fallback_url=${encodeURIComponent(web)};end`;
}

/** Ouvre Facebook tout de suite — pas le menu de partage, pas fb://. */
export function openFacebookShare(url: string, _quote?: string) {
  if (!url || typeof window === "undefined") return;
  const web = buildFacebookShareUrl(url);

  if (isStandaloneDisplay() || isAndroidUserAgent()) {
    window.location.assign(buildFacebookShareHref(url));
    window.setTimeout(() => {
      if (document.visibilityState === "visible") window.location.assign(web);
    }, 700);
    return;
  }

  window.location.assign(web);
}
