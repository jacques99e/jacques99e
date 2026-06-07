export function traceUrl(hash: string): string {
  const short = hash.slice(0, 16);
  const base =
    typeof window !== "undefined"
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_APP_URL || "https://wazo-digital.vercel.app").replace(/\/$/, "");
  return `${base}/trace/${encodeURIComponent(short)}`;
}

export interface PublicTracePayload {
  name: string;
  asset_type: string;
  hash_sha256: string;
  description: string | null;
  recorded_at: string | null;
  verified: boolean;
}

export async function fetchPublicTrace(hashPrefix: string): Promise<PublicTracePayload> {
  const res = await fetch(`/api/blockchain/public/${encodeURIComponent(hashPrefix)}`);
  const json = (await res.json()) as {
    success: boolean;
    error?: string;
    asset?: PublicTracePayload;
  };
  if (!res.ok || !json.success || !json.asset) {
    throw new Error(json.error || "Actif introuvable");
  }
  return json.asset;
}
