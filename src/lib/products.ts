import { db } from "@/lib/db";
import { supabase } from "@/lib/supabase/client";
import { enqueueSync, generateLocalId } from "@/lib/sync";
import type { Product } from "@/types";

export async function getProducts(storeId: string): Promise<Product[]> {
  if (db) {
    const local = await db.products.where("store_id").equals(storeId).toArray();
    if (local.length > 0 || !navigator.onLine) return local;
  }

  if (navigator.onLine) {
    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("store_id", storeId)
      .order("name");

    if (data && db) {
      await db.products.bulkPut(data.map((p) => ({ ...p, price: Number(p.price) })));
      return data.map((p) => ({ ...p, price: Number(p.price) }));
    }
    return data?.map((p) => ({ ...p, price: Number(p.price) })) || [];
  }

  return [];
}

export async function saveProduct(
  storeId: string,
  product: Partial<Product> & { name: string; price: number; stock_quantity: number }
): Promise<Product> {
  const localId = product._localId || generateLocalId();
  const id = product.id || localId;
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
    _localId: id.startsWith("local-") ? id : undefined,
    _pendingSync: true,
  };

  if (db) await db.products.put(record);

  await enqueueSync({
    entity_type: "product",
    entity_id: id,
    action: product.id && !product.id.startsWith("local-") ? "update" : "create",
    payload: record as unknown as Record<string, unknown>,
  });

  if (navigator.onLine && !id.startsWith("local-")) {
    const { data } = await supabase
      .from("products")
      .upsert({
        id: id.startsWith("local-") ? undefined : id,
        store_id: storeId,
        name: record.name,
        description: record.description,
        price: record.price,
        stock_quantity: record.stock_quantity,
        barcode: record.barcode,
        image_url: record.image_url,
        is_active: record.is_active,
      })
      .select()
      .single();

    if (data && db) {
      await db.products.put({ ...data, price: Number(data.price), _pendingSync: false });
      return { ...data, price: Number(data.price) };
    }
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
  if (navigator.onLine) {
    await supabase.from("products").delete().eq("id", id);
  }
}

export async function uploadProductImage(
  userId: string,
  file: File
): Promise<string | null> {
  if (!navigator.onLine) return URL.createObjectURL(file);

  const ext = file.name.split(".").pop() || "jpg";
  const path = `${userId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from("product-images")
    .upload(path, file, { upsert: true });

  if (error) return URL.createObjectURL(file);

  const { data } = supabase.storage.from("product-images").getPublicUrl(path);
  return data.publicUrl;
}
