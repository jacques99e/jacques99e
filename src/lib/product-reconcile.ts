import { db } from "@/lib/db";
import { readLocalProducts } from "@/lib/local-products";
import { isProductUuid } from "@/lib/product-db-map";
import { getProducts, saveProduct } from "@/lib/products";
import type { Product } from "@/types";

/** Pousse les produits locaux (Dexie / ancien localStorage) vers Supabase. */
export async function reconcileProductsWithCloud(storeId: string): Promise<number> {
  if (!navigator.onLine) return 0;

  const cloud = await getProducts(storeId);
  const cloudIds = new Set(cloud.map((p) => p.id));
  const cloudNames = new Set(cloud.map((p) => p.name.trim().toLowerCase()));

  const candidates: Array<Partial<Product> & { name: string; price: number; stock_quantity: number }> =
    [];

  if (db) {
    const dexieRows = await db.products.where("store_id").equals(storeId).toArray();
    for (const row of dexieRows) {
      const needsSync =
        row._pendingSync || !isProductUuid(row.id) || !cloudIds.has(row.id);
      if (!needsSync) continue;
      if (cloudNames.has(row.name.trim().toLowerCase()) && isProductUuid(row.id) && cloudIds.has(row.id)) {
        continue;
      }
      candidates.push(row);
    }
  }

  if (cloud.length === 0) {
    for (const legacy of readLocalProducts()) {
      const key = legacy.name.trim().toLowerCase();
      if (cloudNames.has(key)) continue;
      candidates.push({
        id: legacy.id,
        name: legacy.name,
        description: legacy.description ?? null,
        price: legacy.price,
        stock_quantity: legacy.stock ?? legacy.stock_quantity ?? 0,
        barcode: null,
        image_url: null,
        is_active: true,
      });
      cloudNames.add(key);
    }
  }

  let pushed = 0;
  for (const product of candidates) {
    try {
      await saveProduct(storeId, product);
      pushed++;
    } catch {
      // Continue with remaining items.
    }
  }

  return pushed;
}
