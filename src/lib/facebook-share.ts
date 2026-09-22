import { isAndroidUserAgent, isStandaloneDisplay, openShareLink } from "@/lib/open-share";

/** Sharer Facebook : l’aperçu vient des balises Open Graph. */
export function buildFacebookShareUrl(url: string): string {
  const share = new URL("https://www.facebook.com/sharer/sharer.php");
  share.searchParams.set("u", url);
  return share.toString();
}

function buildFacebookAppUrl(url: string): string {
  return `fb://facewebmodal/f?href=${encodeURIComponent(buildFacebookShareUrl(url))}`;
}

/** Ouvre Facebook tout de suite — pas le menu de partage du téléphone. */
export function openFacebookShare(url: string, _quote?: string) {
  if (!url) return;
  const href = buildFacebookShareUrl(url);

  if (isStandaloneDisplay() && isAndroidUserAgent()) {
    window.location.assign(buildFacebookAppUrl(url));
    window.setTimeout(() => {
      if (document.visibilityState === "visible") window.location.assign(href);
    }, 500);
    return;
  }

  openShareLink(href);
}
