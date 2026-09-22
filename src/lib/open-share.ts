/** Ouvre WhatsApp / Facebook hors de l’app (PWA Android bloque souvent window.open). */

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

export function canNativeShare(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

export function isAndroidUserAgent(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

function clickHiddenLink(url: string, target: "_blank" | "_self"): boolean {
  try {
    const a = document.createElement("a");
    a.href = url;
    a.target = target;
    a.rel = "noopener noreferrer";
    a.referrerPolicy = "no-referrer";
    a.style.position = "fixed";
    a.style.left = "-9999px";
    document.body.appendChild(a);
    a.click();
    a.remove();
    return true;
  } catch {
    return false;
  }
}

/**
 * Ouvre une URL externe. En PWA, window.open renvoie souvent une fenêtre
 * fantôme : on quitte l’app avec une navigation réelle.
 */
export function openShareLink(url: string): boolean {
  if (typeof window === "undefined" || !url) return false;

  if (isStandaloneDisplay()) {
    window.location.assign(url);
    return true;
  }

  if (clickHiddenLink(url, "_blank")) return true;
  window.location.assign(url);
  return true;
}

export function openNativeShare(data: ShareData): Promise<boolean> {
  if (!canNativeShare()) return Promise.resolve(false);
  return navigator
    .share(data)
    .then(() => true)
    .catch((err: unknown) => {
      const name = err instanceof Error ? err.name : "";
      if (name === "AbortError") return true;
      return false;
    });
}
