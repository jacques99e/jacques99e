import { apiFetch } from "@/lib/api-client";
import { db } from "@/lib/db";
import { fetchCloudProducts } from "@/lib/product-cloud";
import { isProductUuid } from "@/lib/product-db-map";
import { mirrorProductsToLegacyCatalog, upsertLegacyProduct } from "@/lib/product-legacy-mirror";
import { supabase } from "@/lib/supabase/client";
import { enqueueSync, generateLocalId, syncAll } from "@/lib/sync";
import type { Product } from "@/types";

async function persistProductViaApi(
  storeId: string,
  product: Partial<Product> & { name: string; price: number; stock_quantity: number }
): Promise<Product> {
  const hasServerId = Boolean(product.id && isProductUuid(product.id));
  const response = await apiFetch("/api/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      store_id: storeId,
      id: hasServerId ? product.id : undefined,
      name: product.name,
      description: product.description ?? null,
      price: product.price,
      stock_quantity: product.stock_quantity,
      barcode: product.barcode ?? null,
      image_url: product.image_url ?? null,
    }),
  });

  const payload = (await response.json()) as {
    success: boolean;
    product?: Product;
    error?: string;
  };

  if (!response.ok || !payload.success || !payload.product) {
    throw new Error(payload.error || "Impossible d'enregistrer le produit en ligne.");
  }

  return payload.product;
}

async function cacheProductsLocally(storeId: string, products: Product[]) {
  if (!db) return;
  await db.products.where("store_id").equals(storeId).delete();
  if (products.length > 0) {
    await db.products.bulkPut(products.map((p) => ({ ...p, _pendingSync: false })));
  }
  mirrorProductsToLegacyCatalog(products);
}

export async function getProducts(storeId: string): Promise<Product[]> {
  const local = db ? await db.products.where("store_id").equals(storeId).toArray() : [];

  if (navigator.onLine) {
    const cloud = await fetchCloudProducts(storeId);
    if (cloud !== null) {
      if (cloud.length > 0) {
        await cacheProductsLocally(storeId, cloud);
        return cloud;
      }
      if (local.length > 0) return local;
    }
  }

  if (local.length > 0) return local;
  return [];
}

export async function saveProduct(
  storeId: string,
  product: Partial<Product> & { name: string; price: number; stock_quantity: number }
): Promise<Product> {
  const hasServerId = Boolean(product.id && isProductUuid(product.id));
  const legacyId =
    product.id && !isProductUuid(product.id) ? product.id : undefined;
  const localId = hasServerId ? undefined : product._localId || generateLocalId();
  const id = hasServerId ? product.id! : localId!;

  const record: Product = {
    id,
    store_id: storeId,
    name: product.name,
    description: product.description ?? null,
    price: product.price,
    stock_quantity: product.stock_quantity,
    barcode: product.barcode ?? null,
    image_url: product.image_url ?? null,
    is_active: product.is_active ?? true,
    _localId: localId,
    _pendingSync: true,
  };

  if (db) {
    if (legacyId && legacyId !== id) await db.products.delete(legacyId);
    await db.products.put(record);
  }
  upsertLegacyProduct(record);

  if (navigator.onLine) {
    try {
      const saved = await persistProductViaApi(storeId, {
        ...product,
        id: hasServerId ? product.id : undefined,
      });
      if (db) {
        if (localId) await db.products.delete(localId);
        if (legacyId && legacyId !== saved.id) await db.products.delete(legacyId);
        await db.products.put({ ...saved, _pendingSync: false });
      }
      upsertLegacyProduct(saved);
      return saved;
    } catch (error) {
      await enqueueSync({
        entity_type: "product",
        entity_id: id,
        action: hasServerId ? "update" : "create",
        payload: record as unknown as Record<string, unknown>,
      });
      void syncAll(storeId);
      throw error instanceof Error
        ? error
        : new Error("Impossible d'enregistrer le produit en ligne.");
    }
  }

  await enqueueSync({
    entity_type: "product",
    entity_id: id,
    action: hasServerId ? "update" : "create",
    payload: record as unknown as Record<string, unknown>,
  });

  return record;
}

export async function deleteProduct(id: string) {
  if (db) await db.products.delete(id);
  await enqueueSync({
    entity_type: "product",
    entity_id: id,
    action: "delete",
    payload: { id },
  });
  if (navigator.onLine && isProductUuid(id)) {
    await supabase.from("products").delete().eq("id", id);
  }
}

export async function uploadProductImage(_userId: string, file: File): Promise<string> {
  if (!navigator.onLine) {
    throw new Error("Connexion requise pour envoyer la photo.");
  }

  const form = new FormData();
  form.append("file", file);

  const response = await apiFetch("/api/uploads/product-image", {
    method: "POST",
    body: form,
  });
  const payload = (await response.json()) as { success: boolean; url?: string; error?: string };

  if (!response.ok || !payload.success || !payload.url) {
    throw new Error(payload.error || "Impossible d'envoyer la photo du produit.");
  }

  return payload.url;
}
