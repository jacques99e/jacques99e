import { getLowStockThreshold } from "@/lib/business-settings";
import { readLocalProducts } from "@/lib/local-products";

/** @deprecated Use getLowStockThreshold() — kept for imports that expect a constant default */
export const LOW_STOCK_THRESHOLD = 5;
export const ALERTS_REFRESH_EVENT = "wazo-alerts-refresh";
const DAILY_DIGEST_KEY = "wazo_daily_digest_date";

export interface AlertSummary {
  outOfStock: number;
  lowStock: number;
  stockAlerts: number;
  followUpsToday: number;
  followUpsOverdue: number;
  clientAlerts: number;
  total: number;
  lowStockItems: Array<{ id: string; name: string; stock: number }>;
}

interface LocalClient {
  id: string;
  nextFollowUp?: string | null;
}

const emptySummary: AlertSummary = {
  outOfStock: 0,
  lowStock: 0,
  stockAlerts: 0,
  followUpsToday: 0,
  followUpsOverdue: 0,
  clientAlerts: 0,
  total: 0,
  lowStockItems: [],
};

function readLocalClients(): LocalClient[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem("wazo_clients");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as LocalClient[]) : [];
  } catch {
    return [];
  }
}

export function computeAlertSummary(): AlertSummary {
  if (typeof window === "undefined") return emptySummary;

  const threshold = getLowStockThreshold();
  const products = readLocalProducts();
  const outOfStock = products.filter((p) => p.stock <= 0).length;
  const lowStockItems = products
    .filter((p) => p.stock > 0 && p.stock <= threshold)
    .map((p) => ({ id: p.id, name: p.name, stock: p.stock }))
    .sort((a, b) => a.stock - b.stock);
  const lowStock = lowStockItems.length;
  const stockAlerts = outOfStock + lowStock;

  const today = new Date().toISOString().slice(0, 10);
  let followUpsToday = 0;
  let followUpsOverdue = 0;
  for (const client of readLocalClients()) {
    const date = client.nextFollowUp;
    if (!date) continue;
    if (date === today) followUpsToday += 1;
    else if (date < today) followUpsOverdue += 1;
  }
  const clientAlerts = followUpsToday + followUpsOverdue;

  return {
    outOfStock,
    lowStock,
    stockAlerts,
    followUpsToday,
    followUpsOverdue,
    clientAlerts,
    total: stockAlerts + clientAlerts,
    lowStockItems: lowStockItems.slice(0, 8),
  };
}

export function notifyAlertsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(ALERTS_REFRESH_EVENT));
}

export function shouldShowDailyDigest(): boolean {
  if (typeof window === "undefined") return false;
  const today = new Date().toISOString().slice(0, 10);
  return localStorage.getItem(DAILY_DIGEST_KEY) !== today;
}

export function markDailyDigestShown() {
  if (typeof window === "undefined") return;
  localStorage.setItem(DAILY_DIGEST_KEY, new Date().toISOString().slice(0, 10));
}

export function buildDailyDigestMessage(summary: AlertSummary): string | null {
  if (summary.total === 0) return null;
  const parts: string[] = [];
  if (summary.stockAlerts > 0) {
    parts.push(
      `${summary.outOfStock} rupture(s), ${summary.lowStock} stock faible (seuil: ${getLowStockThreshold()})`
    );
  }
  if (summary.clientAlerts > 0) {
    parts.push(
      `${summary.followUpsToday} relance(s) aujourd'hui, ${summary.followUpsOverdue} en retard`
    );
  }
  return `Rappel du jour: ${parts.join(" · ")}.`;
}
