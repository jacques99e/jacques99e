/** SHA-256 hash for blockchain asset integrity (browser + Node). */
export async function sha256(message: string): Promise<string> {
  const data = new TextEncoder().encode(message);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function buildAssetHash(payload: Record<string, unknown>): Promise<string> {
  const canonical = JSON.stringify(payload, Object.keys(payload).sort());
  return sha256(canonical + Date.now().toString());
}
