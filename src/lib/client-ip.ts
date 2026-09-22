/**
 * IP du visiteur. Sur Vercel, le premier X-Forwarded-For peut être inventé
 * par le client : on prend x-real-ip, sinon le dernier relais ajouté par la plateforme.
 */
export function clientIp(request: Request): string {
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const cf = request.headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  const hops = (request.headers.get("x-forwarded-for") || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (!hops.length) return "unknown";
  return process.env.VERCEL ? hops[hops.length - 1] : hops[0];
}
