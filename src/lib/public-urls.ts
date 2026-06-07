const PROD_LANDING_URL = "https://landing-jacques99e.vercel.app";
const PROD_APP_URL = "https://wazo-digital.vercel.app";
const DEV_LANDING_URL = "http://localhost:3000";
const DEV_APP_URL = "http://localhost:3001";

function isLocalhostHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function isLocalhostUrl(url: string): boolean {
  try {
    return isLocalhostHostname(new URL(url).hostname);
  } catch {
    return true;
  }
}

export function isBrowserOnLocalhost(): boolean {
  if (typeof window === "undefined") return false;
  return isLocalhostHostname(window.location.hostname);
}

/** En production (Vercel, domaine public) : toujours l'URL prod, jamais localhost. */
function isProductionBrowser(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  if (isLocalhostHostname(h)) return false;
  return true;
}

export function resolveLandingUrl(): string {
  if (isProductionBrowser()) return PROD_LANDING_URL;

  const envUrl = process.env.NEXT_PUBLIC_LANDING_URL?.trim().replace(/\/$/, "");
  if (isBrowserOnLocalhost()) {
    return envUrl && !isLocalhostUrl(envUrl) ? envUrl : DEV_LANDING_URL;
  }
  if (envUrl && !isLocalhostUrl(envUrl)) return envUrl;
  return PROD_LANDING_URL;
}

export function getLandingLoginUrl(): string {
  return `${resolveLandingUrl()}/login`;
}

export function resolveAppUrl(): string {
  if (isProductionBrowser()) return PROD_APP_URL;

  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (isBrowserOnLocalhost()) {
    return envUrl && !isLocalhostUrl(envUrl) ? envUrl : DEV_APP_URL;
  }
  if (envUrl && !isLocalhostUrl(envUrl)) return envUrl;
  return PROD_APP_URL;
}
