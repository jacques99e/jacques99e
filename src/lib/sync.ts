import { v4 as uuidv4 } from "uuid";
import { supabase } from "@/lib/supabase/client";
import { db } from "@/lib/db";
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
    await db.products.where("store_id").equals(storeId).delete();
    await db.products.bulkPut(
      products.map((p) => ({ ...p, price: Number(p.price), _pendingSync: false }))
    );
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
    const { data, error } = await supabase
      .from("products")
      .upsert({
        id: payload.id?.startsWith("local-") ? undefined : payload.id,
        store_id: storeId,
        name: payload.name,
        description: payload.description,
        price: payload.price,
        stock_quantity: payload.stock_quantity,
        barcode: payload.barcode,
        image_url: payload.image_url,
        is_active: payload.is_active ?? true,
      })
      .select()
      .single();

    if (error) throw error;

    if (payload._localId && data) {
      await db.products.where("_localId").equals(payload._localId).modify({
        id: data.id,
        _pendingSync: false,
        _localId: undefined,
      });
    }
  } else if (item.action === "delete") {
    await supabase.from("products").delete().eq("id", item.entity_id);
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

  const { data: sale, error } = await supabase
    .from("sales")
    .insert({
      store_id: storeId,
      total_amount: payload.total_amount,
      payment_method: payload.payment_method,
      payment_status: payload.payment_status,
      client_local_id: payload.client_local_id || payload._localId,
    })
    .select()
    .single();

  if (error) throw error;

  if (payload.items?.length) {
    await supabase.from("sale_items").insert(
      payload.items.map((i) => ({
        sale_id: sale.id,
        product_id: i.product_id,
        product_name: i.product_name,
        quantity: i.quantity,
        unit_price: i.unit_price,
        subtotal: i.subtotal,
      }))
    );
  }

  // Update stock on server
  for (const i of payload.items || []) {
    const { data: product } = await supabase
      .from("products")
      .select("stock_quantity")
      .eq("id", i.product_id)
      .single();

    if (product) {
      await supabase
        .from("products")
        .update({ stock_quantity: Math.max(0, product.stock_quantity - i.quantity) })
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
