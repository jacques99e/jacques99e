import { apiFetch } from "@/lib/api-client";
import { rowToProduct } from "@/lib/product-db-map";
import { supabase } from "@/lib/supabase/client";
import type { Product } from "@/types";

/** Lecture cloud uniquement — ne modifie pas Dexie ni localStorage. */
export async function fetchCloudProducts(storeId: string): Promise<Product[] | null> {
  if (!navigator.onLine) return null;

  try {
    const response = await apiFetch(`/api/products?storeId=${encodeURIComponent(storeId)}`, {
      cache: "no-store",
    });
    const payload = (await response.json()) as {
      success: boolean;
      products?: Product[];
    };
    if (response.ok && payload.success && payload.products) {
      return payload.products;
    }
  } catch {
    // Fallback below.
  }

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("store_id", storeId)
    .order("name");

  if (error || !data) return null;
  return data.map((row) => rowToProduct(row as Record<string, unknown>));
}

export async function pushProductsBatchToCloud(
  storeId: string,
  products: Array<Partial<Product> & { name: string; price: number; stock_quantity: number }>
): Promise<{ synced: number; errors: string[] }> {
  const response = await apiFetch("/api/products/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ store_id: storeId, products }),
  });
  const payload = (await response.json()) as {
    success: boolean;
    synced?: number;
    products?: Product[];
    errors?: string[];
    error?: string;
  };

  if (!response.ok || !payload.success) {
    throw new Error(payload.error || "Synchronisation boutique impossible.");
  }

  return {
    synced: payload.synced ?? 0,
    errors: payload.errors ?? [],
  };
}
