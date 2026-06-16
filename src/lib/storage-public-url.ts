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
  if (/^https?:\/\//i.test(value)) return value;

  const withoutBucketPrefix = value.startsWith("product-images/")
    ? value.slice("product-images/".length)
    : value.replace(/^\/+/, "");

  if (!SUPABASE_URL) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/product-images/${encodePath(withoutBucketPrefix)}`;
}
