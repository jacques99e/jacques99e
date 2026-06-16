import type { LocalProduct } from "@/lib/local-products";
import { readLocalProducts, writeLocalProducts } from "@/lib/local-products";
import type { Product } from "@/types";

export function productToLegacy(p: Product): LocalProduct {
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? "",
    price: p.price,
    stock: p.stock_quantity,
    stock_quantity: p.stock_quantity,
    category: "Autre",
    createdAt: p.created_at ?? new Date().toISOString(),
  };
}

export function legacyProductsForStore(): LocalProduct[] {
  return readLocalProducts();
}

export function mirrorProductsToLegacyCatalog(products: Product[]) {
  if (typeof window === "undefined" || products.length === 0) return;
  writeLocalProducts(products.map(productToLegacy));
}

export function upsertLegacyProduct(product: Product) {
  if (typeof window === "undefined") return;
  const list = readLocalProducts().filter((p) => p.id !== product.id);
  list.unshift(productToLegacy(product));
  writeLocalProducts(list);
}

export function collectLocalProductSnapshots(
  storeId: string,
  dexieRows: Product[]
): Array<Partial<Product> & { name: string; price: number; stock_quantity: number }> {
  const byKey = new Map<
    string,
    Partial<Product> & { name: string; price: number; stock_quantity: number }
  >();

  for (const row of dexieRows) {
    if (row.store_id && row.store_id !== storeId) continue;
    const key = row.name.trim().toLowerCase();
    byKey.set(key, row);
  }

  for (const legacy of readLocalProducts()) {
    const key = legacy.name.trim().toLowerCase();
    if (byKey.has(key)) continue;
    byKey.set(key, {
      id: legacy.id,
      name: legacy.name,
      description: legacy.description ?? null,
      price: legacy.price,
      stock_quantity: legacy.stock ?? legacy.stock_quantity ?? 0,
      barcode: null,
      image_url: null,
      is_active: true,
    });
  }

  return [...byKey.values()];
}
