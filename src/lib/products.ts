import { apiFetch } from "@/lib/api-client";
import { db, localStore } from "@/lib/db";
import { fetchCloudProducts } from "@/lib/product-cloud";
import { isProductUuid } from "@/lib/product-db-map";
import {
  legacyProductsForStore,
  mirrorProductsToLegacyCatalog,
  removeLegacyProduct,
  upsertLegacyProduct,
} from "@/lib/product-legacy-mirror";
import { readLocalProducts } from "@/lib/local-products";
import { supabase } from "@/lib/supabase/client";
import { enqueueSync, generateLocalId, syncAll } from "@/lib/sync";
import type { Product } from "@/types";

function legacyToProduct(storeId: string, legacy: ReturnType<typeof readLocalProducts>[number]): Product {
  return {
    id: legacy.id,
    store_id: storeId,
    name: legacy.name,
    description: legacy.description ?? null,
    price: legacy.price,
    stock_quantity: legacy.stock ?? legacy.stock_quantity ?? 0,
    barcode: null,
    image_url: null,
    is_active: true,
  };
}

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

  const legacy = legacyProductsForStore();
  if (legacy.length > 0) {
    return legacy.map((p) => legacyToProduct(storeId, p));
  }
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

export async function deleteProduct(id: string, storeId?: string) {
  const resolvedStoreId = storeId ?? (typeof window !== "undefined" ? localStore.get()?.id : undefined);

  if (db) await db.products.delete(id);
  removeLegacyProduct(id);

  if (navigator.onLine && isProductUuid(id) && resolvedStoreId) {
    const response = await apiFetch("/api/products", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, store_id: resolvedStoreId }),
    });
    const payload = (await response.json()) as { success?: boolean; error?: string };
    if (!response.ok || !payload.success) {
      throw new Error(payload.error || "Impossible de supprimer le produit en ligne.");
    }
    if (db) {
      const pending = await db.syncQueue
        .where("entity_type")
        .equals("product")
        .filter((item) => item.entity_id === id && item.action === "delete")
        .toArray();
      for (const item of pending) {
        if (item.id) await db.syncQueue.delete(item.id);
      }
    }
    return;
  }

  await enqueueSync({
    entity_type: "product",
    entity_id: id,
    action: "delete",
    payload: { id, store_id: resolvedStoreId },
  });
}

export async function uploadProductImage(
  _userId: string,
  file: File
): Promise<string> {
  if (!navigator.onLine) {
    throw new Error("Connexion requise pour enregistrer la photo.");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("bucket", "product-images");

  const response = await apiFetch("/api/media/upload", {
    method: "POST",
    body: formData,
  });

  const payload = (await response.json()) as {
    success: boolean;
    url?: string;
    error?: string;
  };

  if (!response.ok || !payload.success || !payload.url) {
    throw new Error(payload.error || "Impossible d'enregistrer la photo du produit.");
  }

  return payload.url;
}
