import { db } from "@/lib/db";
import { supabase } from "@/lib/supabase/client";
import { enqueueSync, generateLocalId } from "@/lib/sync";
import type { CartItem, PaymentMethod, Sale, SaleItem } from "@/types";

export async function completeSale(
  storeId: string,
  cart: CartItem[],
  paymentMethod: PaymentMethod
): Promise<Sale> {
  const items: SaleItem[] = cart.map((c) => ({
    product_id: c.product.id,
    product_name: c.product.name,
    quantity: c.quantity,
    unit_price: c.product.price,
    subtotal: c.product.price * c.quantity,
  }));

  const total = items.reduce((s, i) => s + i.subtotal, 0);
  const localId = generateLocalId();

  const sale: Sale = {
    id: localId,
    store_id: storeId,
    total_amount: total,
    payment_method: paymentMethod,
    payment_status: "completed",
    client_local_id: localId,
    created_at: new Date().toISOString(),
    _localId: localId,
    _pendingSync: true,
    items,
  };

  if (db) {
    await db.sales.put(sale);
    await db.saleItems.bulkAdd(
      items.map((i) => ({
        sale_local_id: localId,
        product_id: i.product_id,
        product_name: i.product_name,
        quantity: i.quantity,
        unit_price: i.unit_price,
        subtotal: i.subtotal,
      }))
    );

    for (const c of cart) {
      const p = await db.products.get(c.product.id);
      if (p) {
        await db.products.update(c.product.id, {
          stock_quantity: Math.max(0, p.stock_quantity - c.quantity),
        });
      }
    }
  }

  await enqueueSync({
    entity_type: "sale",
    entity_id: localId,
    action: "create",
    payload: { ...sale, items } as unknown as Record<string, unknown>,
  });

  if (navigator.onLine) {
    const { data: saleRow } = await supabase
      .from("sales")
      .insert({
        store_id: storeId,
        total_amount: total,
        payment_method: paymentMethod,
        payment_status: "completed",
        client_local_id: localId,
      })
      .select()
      .single();

    if (saleRow) {
      await supabase.from("sale_items").insert(
        items.map((i) => ({
          sale_id: saleRow.id,
          product_id: i.product_id.startsWith("local-") ? null : i.product_id,
          product_name: i.product_name,
          quantity: i.quantity,
          unit_price: i.unit_price,
          subtotal: i.subtotal,
        }))
      );

      for (const c of cart) {
        if (!c.product.id.startsWith("local-")) {
          await supabase
            .from("products")
            .update({
              stock_quantity: Math.max(0, c.product.stock_quantity - c.quantity),
            })
            .eq("id", c.product.id);
        }
      }

      sale.id = saleRow.id;
      sale._pendingSync = false;
      if (db) await db.sales.put(sale);
    }
  }

  return sale;
}

export async function getSales(storeId: string, date?: string): Promise<Sale[]> {
  if (db) {
    const all = await db.sales
      .where("store_id")
      .equals(storeId)
      .reverse()
      .sortBy("created_at");

    if (date) {
      return all.filter((s) => s.created_at?.startsWith(date));
    }
    return all;
  }
  return [];
}

export async function getDashboardStats(storeId: string) {
  const today = new Date().toISOString().split("T")[0];
  const sales = await getSales(storeId, today);
  const products = db
    ? await db.products.where("store_id").equals(storeId).toArray()
    : [];

  const todayTotal = sales.reduce((s, sale) => s + Number(sale.total_amount), 0);
  const lowStock = products.filter((p) => p.stock_quantity <= 0);

  const last7: { date: string; total: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const daySales = await getSales(storeId, dateStr);
    last7.push({
      date: dateStr,
      total: daySales.reduce((s, sale) => s + Number(sale.total_amount), 0),
    });
  }

  return {
    todayTotal,
    transactionCount: sales.length,
    lowStock,
    chartData: last7,
  };
}
