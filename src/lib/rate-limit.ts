import { clientIp } from "@/lib/client-ip";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function prune(now: number) {
  if (buckets.size < 4000) return;
  for (const [key, bucket] of buckets) {
    if (now > bucket.resetAt) buckets.delete(key);
  }
}

function memoryAllow(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    prune(now);
    return true;
  }
  if (bucket.count >= max) return false;
  bucket.count += 1;
  return true;
}

/** null = base indisponible, le compteur mémoire prend le relais. */
async function sharedAllow(key: string, max: number, windowMs: number): Promise<boolean | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  const safeKey = `wazo-app:${key}`.replace(/[^\w:.\-@+]/g, "").slice(0, 180);
  if (!safeKey || !Number.isFinite(max) || !Number.isFinite(windowMs)) return null;

  try {
    const res = await fetch(`${url}/rest/v1/rpc/consume_rate_limit`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_key: safeKey,
        p_max: Math.floor(max),
        p_window_ms: Math.floor(windowMs),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    return typeof data === "boolean" ? data : null;
  } catch {
    return null;
  }
}

export async function allowRequest(key: string, max: number, windowMs: number): Promise<boolean> {
  const shared = await sharedAllow(key, max, windowMs);
  if (shared !== null) return shared;
  return memoryAllow(`wazo-app:${key}`, max, windowMs);
}

export async function allowIp(
  request: Request,
  scope: string,
  max: number,
  windowMs: number
): Promise<boolean> {
  return allowRequest(`${scope}:${clientIp(request)}`, max, windowMs);
}

export async function allowUser(
  userId: string,
  scope: string,
  max: number,
  windowMs: number
): Promise<boolean> {
  return allowRequest(`${scope}:${userId}`, max, windowMs);
}
