const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");

function encodePath(path: string): string {
  return path
    .split("/")
    .filter(Boolean)
    .map((chunk) => encodeURIComponent(chunk))
    .join("/");
}

export function toPublicProductImageUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  const value = input.trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== "https:") return null;
      const supabaseHost = SUPABASE_URL ? new URL(SUPABASE_URL).hostname : "";
      const host = parsed.hostname.toLowerCase();
      const allowed =
        (supabaseHost && host === supabaseHost.toLowerCase()) ||
        host.endsWith(".supabase.co");
      return allowed ? parsed.toString() : null;
    } catch {
      return null;
    }
  }

  const withoutBucketPrefix = value.startsWith("product-images/")
    ? value.slice("product-images/".length)
    : value.replace(/^\/+/, "");

  if (!SUPABASE_URL) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/product-images/${encodePath(withoutBucketPrefix)}`;
}
