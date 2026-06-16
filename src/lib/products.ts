import { db } from "@/lib/db";
import { isProductUuid, productToRow, rowToProduct } from "@/lib/product-db-map";
import { supabase } from "@/lib/supabase/client";
import { enqueueSync, generateLocalId, syncAll } from "@/lib/sync";
import type { Product } from "@/types";

export async function getProducts(storeId: string): Promise<Product[]> {
  if (navigator.onLine) {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("store_id", storeId)
      .order("name");

    if (!error && data) {
      const mapped = data.map((row) => rowToProduct(row as Record<string, unknown>));
      if (db) {
        await db.products.where("store_id").equals(storeId).delete();
        await db.products.bulkPut(mapped.map((p) => ({ ...p, _pendingSync: false })));
      }
      return mapped;
    }
  }

  if (db) {
    const local = await db.products.where("store_id").equals(storeId).toArray();
    if (local.length > 0) return local;
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

  if (navigator.onLine) {
    const row = productToRow(record);
    const query = hasServerId
      ? supabase.from("products").update(row).eq("id", id).select().single()
      : supabase.from("products").insert(row).select().single();

    const { data, error } = await query;

    if (!error && data) {
      const saved = rowToProduct(data as Record<string, unknown>);
      if (db) {
        if (localId) await db.products.delete(localId);
        await db.products.put({ ...saved, _pendingSync: false });
      }
      return saved;
    }
  }

  await enqueueSync({
    entity_type: "product",
    entity_id: id,
    action: hasServerId ? "update" : "create",
    payload: record as unknown as Record<string, unknown>,
  });

  if (navigator.onLine) {
    void syncAll(storeId);
  }

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

export async function uploadProductImage(
  userId: string,
  file: File
): Promise<string | null> {
  if (!navigator.onLine) return null;

  const ext = file.name.split(".").pop() || "jpg";
  const path = `${userId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from("product-images")
    .upload(path, file, { upsert: true });

  if (error) return null;

  const { data } = supabase.storage.from("product-images").getPublicUrl(path);
  return data.publicUrl;
}
