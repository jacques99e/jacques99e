import { supabase } from "@/lib/supabase/client";
import {
  mergeCloudClients,
  readLocalClients,
  writeLocalClients,
} from "@/lib/local-clients";
import { writeLocalSales } from "@/lib/local-sales";
import {
  mergeCloudSales,
  readLocalSales,
} from "@/lib/local-sales";
import { readLocalProducts } from "@/lib/local-products";

export interface CloudSyncResult {
  clientsPushed: number;
  clientsPulled: number;
  salesPushed: number;
  salesPulled: number;
  localClients: number;
  localSales: number;
  localSalesPending: number;
  errors: string[];
}

function formatSupabaseError(error: { message: string; code?: string }): string {
  return error.code ? `${error.message} (${error.code})` : error.message;
}

function toIsoDate(d: string | null | undefined): string | null {
  if (!d) return null;
  return d.slice(0, 10);
}

export async function pushClientsToCloud(
  storeId: string,
  errors: string[]
): Promise<number> {
  const clients = readLocalClients(storeId);
  let pushed = 0;

  for (const client of clients) {
    const row = {
      store_id: storeId,
      external_local_id: client.id,
      name: client.name,
      phone: client.phone || null,
      tags: client.tags,
      status: client.status,
      next_follow_up: toIsoDate(client.nextFollowUp),
      note: client.note || null,
      updated_at: new Date().toISOString(),
    };

    if (client.cloud_id) {
      const { error } = await supabase
        .from("crm_clients")
        .update(row)
        .eq("id", client.cloud_id);
      if (!error) pushed++;
      else errors.push(`Client ${client.name}: ${formatSupabaseError(error)}`);
      continue;
    }

    const { data, error } = await supabase
      .from("crm_clients")
      .upsert(row, { onConflict: "store_id,external_local_id" })
      .select("id")
      .maybeSingle();

    if (!error && data?.id) {
      client.cloud_id = data.id;
      pushed++;
    } else if (error) {
      errors.push(`Client ${client.name}: ${formatSupabaseError(error)}`);
    }
  }

  writeLocalClients(clients, storeId);
  return pushed;
}

export async function pullClientsFromCloud(
  storeId: string,
  errors: string[]
): Promise<number> {
  const { data, error } = await supabase
    .from("crm_clients")
    .select("*")
    .eq("store_id", storeId)
    .order("updated_at", { ascending: false });

  if (error) {
    errors.push(`Lecture clients cloud: ${formatSupabaseError(error)}`);
    return 0;
  }
  if (!data) return 0;
  mergeCloudClients(storeId, data);
  return data.length;
}

export async function pushSalesToCloud(
  storeId: string,
  errors: string[]
): Promise<number> {
  const sales = readLocalSales(storeId).filter((s) => !s.cloud_id);
  let pushed = 0;

  for (const sale of sales) {
    const total = Number(sale.total ?? sale.total_amount ?? 0);
    const salePayload = {
      store_id: storeId,
      total_amount: total,
      total: total,
      payment_method: sale.payment_method || "cash",
      payment_status: sale.payment_status || "completed",
      external_local_id: sale.id,
    };

    const { data: saleRow, error } = await supabase
      .from("sales")
      .upsert(salePayload, { onConflict: "store_id,external_local_id" })
      .select("id")
      .maybeSingle();

    if (error) {
      errors.push(`Vente ${sale.id.slice(0, 12)}: ${formatSupabaseError(error)}`);
      continue;
    }
    if (!saleRow) continue;

    const items = sale.items || [];
    if (items.length) {
      await supabase.from("sale_items").delete().eq("sale_id", saleRow.id);
      const { error: itemsError } = await supabase.from("sale_items").insert(
        items.map((i) => ({
          sale_id: saleRow.id,
          product_id: i.product_id?.startsWith("local-") ? null : i.product_id || null,
          product_name: i.name || i.product_name || "Produit",
          quantity: i.quantity,
          unit_price: Number(i.unit_price ?? 0),
          subtotal: Number(i.line_total ?? i.subtotal ?? 0),
        }))
      );
      if (itemsError) {
        errors.push(`Lignes vente ${sale.id.slice(0, 12)}: ${formatSupabaseError(itemsError)}`);
      }
    }

    sale.cloud_id = saleRow.id;
    pushed++;
  }

  const all = readLocalSales(storeId);
  const updated = all.map((s) => {
    const match = sales.find((x) => x.id === s.id);
    return match?.cloud_id ? { ...s, cloud_id: match.cloud_id } : s;
  });
  writeLocalSales(updated, storeId);
  return pushed;
}

export async function pullSalesFromCloud(
  storeId: string,
  errors: string[]
): Promise<number> {
  const { data, error } = await supabase
    .from("sales")
    .select(
      `
      id,
      external_local_id,
      total_amount,
      total,
      payment_method,
      payment_status,
      created_at,
      sale_items (
        product_id,
        product_name,
        quantity,
        unit_price,
        subtotal
      )
    `
    )
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    errors.push(`Lecture ventes cloud: ${formatSupabaseError(error)}`);
    return 0;
  }
  if (!data) return 0;

  const rows = data.map((row) => ({
    ...row,
    sale_items: Array.isArray(row.sale_items) ? row.sale_items : [],
  }));

  mergeCloudSales(storeId, rows);
  return rows.length;
}

export async function syncStoreToCloud(storeId: string): Promise<CloudSyncResult> {
  const errors: string[] = [];
  let clientsPushed = 0;
  let clientsPulled = 0;
  let salesPushed = 0;
  let salesPulled = 0;

  const localClients = readLocalClients(storeId);
  const localSales = readLocalSales(storeId);
  const localSalesPending = localSales.filter((s) => !s.cloud_id).length;

  if (!navigator.onLine) {
    return {
      clientsPushed,
      clientsPulled,
      salesPushed,
      salesPulled,
      localClients: localClients.length,
      localSales: localSales.length,
      localSalesPending,
      errors: ["Hors ligne"],
    };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    errors.push("Session expirée — reconnectez-vous puis réessayez.");
    return {
      clientsPushed,
      clientsPulled,
      salesPushed,
      salesPulled,
      localClients: localClients.length,
      localSales: localSales.length,
      localSalesPending,
      errors,
    };
  }

  try {
    clientsPushed = await pushClientsToCloud(storeId, errors);
  } catch (e) {
    errors.push(e instanceof Error ? e.message : "Erreur push clients");
  }

  try {
    salesPushed = await pushSalesToCloud(storeId, errors);
  } catch (e) {
    errors.push(e instanceof Error ? e.message : "Erreur push ventes");
  }

  try {
    clientsPulled = await pullClientsFromCloud(storeId, errors);
  } catch (e) {
    errors.push(e instanceof Error ? e.message : "Erreur pull clients");
  }

  try {
    salesPulled = await pullSalesFromCloud(storeId, errors);
  } catch (e) {
    errors.push(e instanceof Error ? e.message : "Erreur pull ventes");
  }

  void readLocalProducts();

  return {
    clientsPushed,
    clientsPulled,
    salesPushed,
    salesPulled,
    localClients: localClients.length,
    localSales: localSales.length,
    localSalesPending,
    errors,
  };
}
