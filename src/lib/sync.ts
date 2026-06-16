import { v4 as uuidv4 } from "uuid";
import { supabase } from "@/lib/supabase/client";
import { db } from "@/lib/db";
import { isProductUuid, productToRow, rowToProduct } from "@/lib/product-db-map";
import type { Product, Sale, SyncQueueItem } from "@/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function enqueueSync(item: Omit<SyncQueueItem, "id" | "created_at">) {
  if (!db) return;
  await db.syncQueue.add({
    ...item,
    created_at: Date.now(),
  });
}

export async function syncAll(storeId: string): Promise<{ synced: number; errors: number }> {
  if (!db || !navigator.onLine) return { synced: 0, errors: 0 };

  let synced = 0;
  let errors = 0;

  const queue = await db.syncQueue.orderBy("created_at").toArray();

  for (const item of queue) {
    try {
      if (item.entity_type === "product") {
        await syncProduct(supabase, storeId, item);
      } else if (item.entity_type === "sale") {
        await syncSale(supabase, storeId, item);
      }
      if (item.id) await db.syncQueue.delete(item.id);
      synced++;
    } catch {
      errors++;
    }
  }

  // Pull latest from server
  const { data: products } = await supabase
    .from("products")
    .select("*")
    .eq("store_id", storeId);

  if (products) {
    const mapped = products.map((p) =>
      rowToProduct(p as Record<string, unknown>)
    );
    await db.products.where("store_id").equals(storeId).delete();
    await db.products.bulkPut(mapped.map((p) => ({ ...p, _pendingSync: false })));
  }

  try {
    const { syncStoreToCloud } = await import("@/lib/cloud-sync");
    await syncStoreToCloud(storeId);
  } catch {
    // Cloud sync optional if tables not migrated yet
  }

  return { synced, errors };
}

async function syncProduct(
  supabase: SupabaseClient,
  storeId: string,
  item: SyncQueueItem
) {
  const payload = item.payload as unknown as Product;

  if (item.action === "create" || item.action === "update") {
    const hasServerId = Boolean(payload.id && isProductUuid(payload.id));
    const row = productToRow({ ...payload, store_id: storeId });
    const query = hasServerId
      ? supabase.from("products").update(row).eq("id", payload.id).select().single()
      : supabase.from("products").insert(row).select().single();

    const { data, error } = await query;
    if (error) throw error;

    if (data) {
      const saved = rowToProduct(data as Record<string, unknown>);
      if (payload._localId) {
        await db.products.delete(payload._localId);
      } else if (payload.id && !isProductUuid(payload.id)) {
        await db.products.delete(payload.id);
      }
      await db.products.put({ ...saved, _pendingSync: false });
    }
  } else if (item.action === "delete") {
    if (isProductUuid(item.entity_id)) {
      await supabase.from("products").delete().eq("id", item.entity_id);
    }
  }
}

async function syncSale(
  supabase: SupabaseClient,
  storeId: string,
  item: SyncQueueItem
) {
  const payload = item.payload as unknown as Sale & { items: Array<{
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }> };

  const localRef = payload._localId || payload.id;
  const total = Number(payload.total_amount ?? 0);

  const { data: sale, error } = await supabase
    .from("sales")
    .upsert(
      {
        store_id: storeId,
        total_amount: total,
        total,
        payment_method: payload.payment_method,
        payment_status: payload.payment_status ?? "completed",
        external_local_id: localRef,
      },
      { onConflict: "store_id,external_local_id" }
    )
    .select()
    .single();

  if (error) throw error;

  if (payload.items?.length) {
    await supabase.from("sale_items").delete().eq("sale_id", sale.id);
    await supabase.from("sale_items").insert(
      payload.items.map((i) => ({
        sale_id: sale.id,
        product_id:
          i.product_id && !String(i.product_id).startsWith("local-")
            ? i.product_id
            : null,
        product_name: i.product_name,
        quantity: i.quantity,
        unit_price: i.unit_price,
        subtotal: i.subtotal,
      }))
    );
  }

  // Update stock on server
  for (const i of payload.items || []) {
    if (!i.product_id || !isProductUuid(String(i.product_id))) continue;

    const { data: product } = await supabase
      .from("products")
      .select("stock")
      .eq("id", i.product_id)
      .single();

    if (product) {
      await supabase
        .from("products")
        .update({ stock: Math.max(0, Number(product.stock) - i.quantity) })
        .eq("id", i.product_id);
    }
  }

  if (payload._localId) {
    await db.sales.where("_localId").equals(payload._localId).modify({
      id: sale.id,
      _pendingSync: false,
    });
  }
}

export function generateLocalId(): string {
  return `local-${uuidv4()}`;
}
