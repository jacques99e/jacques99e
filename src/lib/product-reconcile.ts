import { db } from "@/lib/db";
import { fetchCloudProducts, pushProductsBatchToCloud } from "@/lib/product-cloud";
import { isProductUuid } from "@/lib/product-db-map";
import { collectLocalProductSnapshots } from "@/lib/product-legacy-mirror";
import { getProducts } from "@/lib/products";
import type { Product } from "@/types";

export interface ReconcileResult {
  pushed: number;
  errors: string[];
}

/** Pousse les produits locaux (Dexie / ancien localStorage) vers Supabase. */
export async function reconcileProductsWithCloud(storeId: string): Promise<ReconcileResult> {
  if (!navigator.onLine) return { pushed: 0, errors: [] };

  const dexieRows = db ? await db.products.where("store_id").equals(storeId).toArray() : [];
  const snapshots = collectLocalProductSnapshots(storeId, dexieRows);
  const cloud = (await fetchCloudProducts(storeId)) ?? [];

  const cloudIds = new Set(cloud.map((p) => p.id));
  const cloudNames = new Set(cloud.map((p) => p.name.trim().toLowerCase()));

  const candidates: Array<Partial<Product> & { name: string; price: number; stock_quantity: number }> =
    [];

  for (const row of snapshots) {
    const nameKey = row.name.trim().toLowerCase();
    const hasServerId = Boolean(row.id && isProductUuid(row.id));
    const alreadyInCloud =
      (hasServerId && cloudIds.has(row.id!)) ||
      cloudNames.has(nameKey);

    if (alreadyInCloud) continue;
    candidates.push(row);
  }

  if (candidates.length === 0) {
    return { pushed: 0, errors: [] };
  }

  try {
    const { synced, errors } = await pushProductsBatchToCloud(storeId, candidates);
    if (synced > 0) {
      await getProducts(storeId);
    }
    return { pushed: synced, errors };
  } catch (error) {
    return {
      pushed: 0,
      errors: [error instanceof Error ? error.message : "Synchronisation impossible."],
    };
  }
}
