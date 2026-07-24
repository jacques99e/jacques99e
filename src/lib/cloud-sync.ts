import { supabase } from "@/lib/supabase/client";
import { apiFetch } from "@/lib/api-client";
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
import {
  replaceSaleItems,
  saleItemProductId,
  upsertSaleByExternalId,
} from "@/lib/sale-cloud";

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
    try {
      const response = await apiFetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          store_id: storeId,
          id: client.cloud_id || undefined,
          external_local_id: client.id,
          name: client.name,
          phone: client.phone || null,
          tags: client.tags,
          status: client.status,
          next_follow_up: toIsoDate(client.nextFollowUp),
          note: client.note || null,
        }),
      });
      const data = (await response.json()) as { success?: boolean; id?: string; error?: string };
      if (response.ok && data.success && data.id) {
        client.cloud_id = data.id;
        pushed++;
      } else {
        errors.push(`Client ${client.name}: ${data.error || response.statusText}`);
      }
    } catch (e) {
      errors.push(
        `Client ${client.name}: ${e instanceof Error ? e.message : "Erreur réseau"}`
      );
    }
  }

  writeLocalClients(clients, storeId);
  return pushed;
}

export async function pullClientsFromCloud(
  storeId: string,
  errors: string[]
): Promise<number> {
  try {
    const response = await apiFetch(`/api/clients?storeId=${encodeURIComponent(storeId)}`);
    const data = (await response.json()) as {
      success?: boolean;
      clients?: Record<string, unknown>[];
      error?: string;
    };
    if (!response.ok || !data.success) {
      errors.push(`Lecture clients cloud: ${data.error || response.statusText}`);
      return 0;
    }
    const rows = (data.clients || []).map((row) => ({
      id: String(row.id ?? ""),
      external_local_id: (row.external_local_id as string | null) ?? null,
      name: String(row.name ?? ""),
      phone: (row.phone as string | null) ?? null,
      tags: row.tags,
      status: String(row.status ?? "prospect"),
      next_follow_up: (row.next_follow_up as string | null) ?? null,
      note: (row.note as string | null) ?? null,
      updated_at: row.updated_at as string | undefined,
    }));
    if (!rows.length) return 0;
    mergeCloudClients(storeId, rows);
    return rows.length;
  } catch (e) {
    errors.push(
      `Lecture clients cloud: ${e instanceof Error ? e.message : "Erreur réseau"}`
    );
    return 0;
  }
}

export async function pushSalesToCloud(
  storeId: string,
  errors: string[]
): Promise<number> {
  const sales = readLocalSales(storeId).filter((s) => !s.cloud_id);
  let pushed = 0;

  for (const sale of sales) {
    const total = Number(sale.total ?? sale.total_amount ?? 0);
    let cloudId: string | null = null;

    try {
      const response = await apiFetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          store_id: storeId,
          external_local_id: sale.id,
          total_amount: total,
          total,
          payment_method: sale.payment_method || "cash",
          payment_status: sale.payment_status || "completed",
          items: sale.items || [],
        }),
      });
      const data = (await response.json()) as { success?: boolean; id?: string; error?: string };
      if (response.ok && data.success && data.id) {
        cloudId = data.id;
      } else if (!response.ok) {
        errors.push(`Vente ${sale.id.slice(0, 12)}: ${data.error || response.statusText}`);
        continue;
      }
    } catch (e) {
      errors.push(
        `Vente ${sale.id.slice(0, 12)}: ${e instanceof Error ? e.message : "Erreur réseau"}`
      );
      continue;
    }

    if (!cloudId) {
      const result = await upsertSaleByExternalId(supabase, storeId, {
        total_amount: total,
        total,
        payment_method: sale.payment_method || "cash",
        payment_status: sale.payment_status || "completed",
        external_local_id: sale.id,
      });
      if ("error" in result) {
        errors.push(`Vente ${sale.id.slice(0, 12)}: ${result.error}`);
        continue;
      }
      cloudId = result.id;
      const items = sale.items || [];
      if (items.length) {
        const itemsResult = await replaceSaleItems(
          supabase,
          cloudId,
          items.map((i) => ({
            product_id: saleItemProductId(i.product_id),
            product_name: i.name || i.product_name || "Produit",
            quantity: i.quantity,
            unit_price: Number(i.unit_price ?? 0),
            subtotal: Number(i.line_total ?? i.subtotal ?? 0),
          }))
        );
        if ("error" in itemsResult) {
          errors.push(`Lignes vente ${sale.id.slice(0, 12)}: ${itemsResult.error}`);
        }
      }
    }

    sale.cloud_id = cloudId;
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
  try {
    const response = await apiFetch(`/api/sales?storeId=${encodeURIComponent(storeId)}`);
    const data = (await response.json()) as {
      success?: boolean;
      sales?: Array<Record<string, unknown> & { sale_items?: unknown }>;
      error?: string;
    };
    if (!response.ok || !data.success) {
      errors.push(`Lecture ventes cloud: ${data.error || response.statusText}`);
      return 0;
    }
    const rows = (data.sales || []).map((row) => {
      const items = Array.isArray(row.sale_items) ? row.sale_items : [];
      return {
        id: String(row.id ?? ""),
        external_local_id: (row.external_local_id as string | null) ?? null,
        total_amount: Number(row.total_amount ?? row.total ?? 0),
        total: Number(row.total ?? row.total_amount ?? 0),
        payment_method: (row.payment_method as string | null) ?? null,
        payment_status: (row.payment_status as string | null) ?? null,
        created_at: String(row.created_at ?? new Date().toISOString()),
        sale_items: items.map((item) => {
          const i = item as Record<string, unknown>;
          return {
            product_id: (i.product_id as string | null) ?? null,
            product_name: (i.product_name as string | null) ?? null,
            quantity: Number(i.quantity ?? 1),
            unit_price: Number(i.unit_price ?? 0),
            subtotal: Number(i.subtotal ?? 0),
          };
        }),
      };
    });
    if (!rows.length) return 0;
    mergeCloudSales(storeId, rows);
    return rows.length;
  } catch (e) {
    errors.push(
      `Lecture ventes cloud: ${e instanceof Error ? e.message : "Erreur réseau"}`
    );
    return 0;
  }
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

  const pendingAfter = readLocalSales(storeId).filter((s) => !s.cloud_id).length;

  return {
    clientsPushed,
    clientsPulled,
    salesPushed,
    salesPulled,
    localClients: localClients.length,
    localSales: readLocalSales(storeId).length,
    localSalesPending: pendingAfter,
    errors,
  };
}
