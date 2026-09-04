import { PROD_APP_URL, PROD_LANDING_URL } from "@/lib/site-urls";

const WEBHOOK_PREFIXES = [
  "/api/payments/momo/callback",
  "/api/auth/send-sms-hook",
  "/api/social/meta/callback",
  "/api/cron/",
];

export function isWebhookPath(pathname: string): boolean {
  return WEBHOOK_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix));
}

export function allowedOrigins(): string[] {
  const app = (process.env.NEXT_PUBLIC_APP_URL || PROD_APP_URL).replace(/\/$/, "");
  const landing = (process.env.NEXT_PUBLIC_LANDING_URL || PROD_LANDING_URL).replace(/\/$/, "");
  return [...new Set([app, landing, PROD_APP_URL, PROD_LANDING_URL])];
}

/**
 * CSRF: browsers send Origin on cross-site POST.
 * Missing Origin is allowed (native apps, PayDunya, scripts with a bearer token).
 */
export function isAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin")?.trim();
  if (!origin) return true;
  return allowedOrigins().some((allowed) => origin === allowed);
}

export function allowPublicApi(pathname: string, method: string): { scope: string; max: number; windowMs: number } | null {
  const m = method.toUpperCase();
  if (pathname.startsWith("/api/boutique/orders") && m === "POST") {
    return { scope: "boutique-orders", max: 12, windowMs: 60 * 60 * 1000 };
  }
  if (pathname.includes("/api/education/public/") && pathname.endsWith("/enroll") && m === "POST") {
    return { scope: "edu-enroll", max: 20, windowMs: 60 * 60 * 1000 };
  }
  if (pathname.includes("/api/education/public/") && pathname.endsWith("/progress") && m === "POST") {
    return { scope: "edu-progress", max: 60, windowMs: 60 * 60 * 1000 };
  }
  if (pathname.startsWith("/api/education/certificates/") && m === "POST") {
    return { scope: "edu-cert", max: 10, windowMs: 60 * 60 * 1000 };
  }
  if (pathname.startsWith("/api/logistics/public/") && m === "GET") {
    return { scope: "logistics-track", max: 40, windowMs: 60 * 60 * 1000 };
  }
  if (pathname.startsWith("/api/payments/momo/callback") && (m === "POST" || m === "GET")) {
    return { scope: "pay-callback", max: 60, windowMs: 60 * 1000 };
  }
  return null;
}
