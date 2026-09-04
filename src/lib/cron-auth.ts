import { secretsEqual } from "@/lib/secret-compare";

function isProdLike(): boolean {
  return (
    process.env.VERCEL_ENV === "production" ||
    process.env.VERCEL_ENV === "preview" ||
    process.env.NODE_ENV === "production"
  );
}

/** Bearer-only cron auth. Fail closed whenever a secret should exist. */
export function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return !isProdLike();
  const auth = request.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  return secretsEqual(bearer, secret);
}
