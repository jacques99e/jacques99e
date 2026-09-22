import { canNativeShare, openNativeShare, openShareLink } from "@/lib/open-share";

/** Sharer Facebook : l’aperçu vient des balises Open Graph. `quote` casse souvent le dialogue. */
export function buildFacebookShareUrl(url: string): string {
  const share = new URL("https://www.facebook.com/sharer/sharer.php");
  share.searchParams.set("u", url);
  return share.toString();
}

export function openFacebookShare(url: string, quote?: string) {
  if (!url) return;
  const href = buildFacebookShareUrl(url);
  const text = quote?.replace(/[\r\n\t]+/g, " ").trim();

  if (canNativeShare()) {
    void openNativeShare({
      url,
      text: text || undefined,
      title: text?.slice(0, 80) || "Wazo Digital",
    }).then((shared) => {
      if (!shared) openShareLink(href);
    });
    return;
  }

  openShareLink(href);
}
