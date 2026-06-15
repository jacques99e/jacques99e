import type { Metadata } from "next";
import { PROD_APP_URL, PROD_LANDING_URL } from "./site-urls";

export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || PROD_APP_URL;
export const SITE_URL =
  process.env.NEXT_PUBLIC_LANDING_URL?.trim().replace(/\/$/, "") || PROD_LANDING_URL;

export const APP_NAME = "Wazo Digital";

export const DEFAULT_DESCRIPTION =
  "Application Wazo Digital : caisse, stock, boutique en ligne, livraisons, formation et traçabilité pour les professionnels en Afrique.";

function siteVerification(): Metadata["verification"] | undefined {
  const google = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();
  if (!google) return undefined;
  return { google };
}

export function buildRootMetadata(): Metadata {
  return {
    metadataBase: new URL(APP_URL),
    title: {
      default: APP_NAME,
      template: `%s | ${APP_NAME}`,
    },
    description: DEFAULT_DESCRIPTION,
    applicationName: APP_NAME,
    manifest: "/manifest.json",
    icons: { icon: "/icons/icon.svg", apple: "/icons/icon.svg" },
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: APP_NAME,
    },
    verification: siteVerification(),
  };
}

export function noIndexMetadata(title: string): Metadata {
  return {
    title,
    robots: { index: false, follow: false },
  };
}

export function publicPageMetadata(
  title: string,
  description: string,
  path: string
): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    robots: { index: true, follow: true },
    openGraph: {
      title: `${title} | ${APP_NAME}`,
      description,
      url: `${APP_URL}${path}`,
      type: "website",
    },
  };
}
