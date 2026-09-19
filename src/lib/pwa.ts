export function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    Boolean(nav.standalone) ||
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches
  );
}

export function isPublicStorefrontPath(pathname: string): boolean {
  return (
    pathname.startsWith("/boutique") ||
    pathname.startsWith("/formation") ||
    pathname.startsWith("/suivi") ||
    pathname.startsWith("/trace")
  );
}

export function isIosSafari(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) || (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
  return iOS && !/CriOS|FxiOS|EdgiOS/.test(ua);
}
