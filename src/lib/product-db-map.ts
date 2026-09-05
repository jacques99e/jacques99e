import type { Product } from "@/types";
import { toPublicProductImageUrl } from "@/lib/storage-public-url";

/** Colonnes réelles Supabase `products` (pas is_active / stock_quantity / image_url). */
export const PRODUCT_DB_COLUMNS =
  "id, store_id, name, description, price, stock, barcode, photo_url, created_at, category, landing_content";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isProductUuid(id: string): boolean {
  return UUID_RE.test(id);
}

/** Ligne Supabase `products` → modèle app. */
export function rowToProduct(row: Record<string, unknown>): Product {
  const stock = Number(row.stock_quantity ?? row.stock ?? 0);
  const resolvedImageUrl = toPublicProductImageUrl(
    (row.image_url as string | null) ?? (row.photo_url as string | null) ?? null
  );
  return {
    id: String(row.id),
    store_id: String(row.store_id),
    name: String(row.name ?? ""),
    description: (row.description as string | null) ?? null,
    price: Number(row.price ?? 0),
    stock_quantity: stock,
    barcode: (row.barcode as string | null) ?? null,
    image_url: resolvedImageUrl,
    is_active: row.is_active !== false,
    created_at: row.created_at as string | undefined,
    updated_at: row.updated_at as string | undefined,
  };
}

/** Modèle app → colonnes réelles Supabase (`stock`, `photo_url`). */
export function productToRow(
  product: Pick<
    Product,
    "store_id" | "name" | "description" | "price" | "stock_quantity" | "barcode"
  > & { id?: string; category?: string | null; image_url?: string | null }
): Record<string, unknown> {
  const row: Record<string, unknown> = {
    store_id: product.store_id,
    name: product.name,
    description: product.description,
    price: product.price,
    stock: product.stock_quantity,
    barcode: product.barcode,
  };
  if (product.image_url !== undefined) {
    row.photo_url = product.image_url;
  }
  if (product.category) row.category = product.category;
  if (product.id && isProductUuid(product.id)) row.id = product.id;
  return row;
}
