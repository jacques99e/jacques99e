import { notifyAlertsChanged } from "@/lib/alerts";

export interface LocalSaleItem {
  product_id?: string;
  name?: string;
  product_name?: string;
  quantity: number;
  unit_price?: number;
  line_total?: number;
  subtotal?: number;
}

export interface LocalSaleRecord {
  id: string;
  store_id: string;
  items: LocalSaleItem[];
  total?: number;
  total_amount?: number;
  date?: string;
  created_at?: string;
  payment_method?: string;
  payment_status?: string;
  client_id?: string;
  cloud_id?: string;
}

const SALES_KEY = "wazo_sales";

function storageKey(storeId: string): string {
  return `${SALES_KEY}_${storeId}`;
}

export function readLocalSales(storeId?: string): LocalSaleRecord[] {
  if (typeof window === "undefined") return [];
  const keys = storeId ? [storageKey(storeId), SALES_KEY] : [SALES_KEY];
  const seen = new Set<string>();
  const all: LocalSaleRecord[] = [];

  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as LocalSaleRecord[];
      if (!Array.isArray(parsed)) continue;
      for (const sale of parsed) {
        const sid = sale.store_id || storeId || "";
        if (storeId && sid && sid !== storeId) continue;
        const id = sale.cloud_id || sale.id;
        if (seen.has(id)) continue;
        seen.add(id);
        all.push({
          ...sale,
          store_id: sid || storeId || "",
        });
      }
    } catch {
      continue;
    }
  }
  return all.sort((a, b) => {
    const da = new Date(a.created_at || a.date || 0).getTime();
    const db = new Date(b.created_at || b.date || 0).getTime();
    return db - da;
  });
}

export function writeLocalSales(sales: LocalSaleRecord[], storeId: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(storeId), JSON.stringify(sales));
  localStorage.setItem(SALES_KEY, JSON.stringify(sales));
  notifyAlertsChanged();
}

export function appendLocalSale(storeId: string, sale: LocalSaleRecord) {
  const sales = readLocalSales(storeId);
  writeLocalSales([sale, ...sales], storeId);
}

export function mergeCloudSales(
  storeId: string,
  cloudRows: Array<{
    id: string;
    external_local_id: string | null;
    total_amount: number | null;
    total?: number | null;
    payment_method: string | null;
    payment_status: string | null;
    created_at: string;
    sale_items?: Array<{
      product_id: string | null;
      product_name: string | null;
      quantity: number;
      unit_price: number;
      subtotal: number | null;
    }>;
  }>
): LocalSaleRecord[] {
  const local = readLocalSales(storeId);
  const byKey = new Map<string, LocalSaleRecord>();
  for (const s of local) {
    byKey.set(s.cloud_id || s.id, s);
  }

  for (const row of cloudRows) {
    const extId = row.external_local_id || row.id;
    const amount = Number(row.total_amount ?? row.total ?? 0);
    const items =
      row.sale_items?.map((i) => ({
        product_id: i.product_id || undefined,
        name: i.product_name || undefined,
        product_name: i.product_name || undefined,
        quantity: i.quantity,
        unit_price: Number(i.unit_price),
        line_total: Number(i.subtotal ?? i.quantity * i.unit_price),
      })) || [];

    const merged: LocalSaleRecord = {
      id: extId,
      cloud_id: row.id,
      store_id: storeId,
      items,
      total: amount,
      total_amount: amount,
      created_at: row.created_at,
      date: row.created_at,
      payment_method: row.payment_method || "cash",
      payment_status: row.payment_status || "completed",
    };
    byKey.set(row.id, merged);
  }

  const merged = [...byKey.values()].sort((a, b) => {
    const da = new Date(a.created_at || a.date || 0).getTime();
    const db = new Date(b.created_at || b.date || 0).getTime();
    return db - da;
  });
  writeLocalSales(merged, storeId);
  return merged;
}
