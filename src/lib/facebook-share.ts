/** Sharer Facebook : l’image vient des balises Open Graph de l’URL publique. */
export function buildFacebookShareUrl(url: string, quote?: string): string {
  const share = new URL("https://www.facebook.com/sharer/sharer.php");
  share.searchParams.set("u", url);
  const text = quote?.replace(/[\r\n\t]+/g, " ").trim();
  if (text) share.searchParams.set("quote", text.slice(0, 500));
  return share.toString();
}

export function openFacebookShare(url: string, quote?: string) {
  window.open(buildFacebookShareUrl(url, quote), "_blank", "noopener,noreferrer");
}
