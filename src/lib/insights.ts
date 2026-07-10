import { getBusinessSettings } from "@/lib/business-settings";
import {
  computeDailyActions,
  dailyActionsToRecommendationLines,
} from "@/lib/daily-actions";
import { localStore } from "@/lib/db";
import { readLocalClients as readClientsForStore } from "@/lib/local-clients";
import { readLocalProducts } from "@/lib/local-products";
import { readLocalSales as readSalesForStore } from "@/lib/local-sales";

export interface DayRevenue {
  date: string;
  total: number;
}

export interface ProductInsight {
  name: string;
  revenue: number;
  quantity: number;
}

export interface ClientInsight {
  id: string;
  name: string;
  phone: string;
  status: string;
  purchases: number;
  revenue: number;
}

export interface BusinessInsights {
  last7Days: DayRevenue[];
  weekRevenue: number;
  prevWeekRevenue: number;
  weekGrowthPercent: number | null;
  avgDailyRevenue: number;
  projectedMonthRevenue: number;
  monthToDateRevenue: number;
  monthlyTarget: number | null;
  targetProgressPercent: number | null;
  topProducts: ProductInsight[];
  topClients: ClientInsight[];
  totalSales: number;
  avgBasket: number;
  stockValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  crmTotal: number;
  crmActiveRate: number;
  recommendations: string[];
}

interface LocalSaleItem {
  name?: string;
  product_name?: string;
  quantity: number;
  unit_price?: number;
  line_total?: number;
}

interface LocalSale {
  id: string;
  items?: LocalSaleItem[];
  total?: number;
  total_amount?: number;
  date?: string;
  created_at?: string;
  client_id?: string;
  client_phone?: string;
}

interface LocalClient {
  id: string;
  name: string;
  phone?: string;
  status?: string;
}

function readLocalSales(): LocalSale[] {
  const storeId = localStore.get()?.id;
  return readSalesForStore(storeId || undefined);
}

function readLocalClients(): LocalClient[] {
  const storeId = localStore.get()?.id;
  return readClientsForStore(storeId || undefined);
}

function saleTotal(sale: LocalSale): number {
  return Number(sale.total ?? sale.total_amount ?? 0);
}

function saleDateIso(sale: LocalSale): string {
  return sale.date || sale.created_at || "";
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function computeBusinessInsights(): BusinessInsights {
  const sales = readLocalSales();
  const products = readLocalProducts();
  const clients = readLocalClients();
  const settings = getBusinessSettings();
  const threshold = settings.lowStockThreshold;

  const today = startOfDay(new Date());
  const last7: DayRevenue[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = dateKey(d);
    const daySales = sales.filter((s) => saleDateIso(s).slice(0, 10) === key);
    last7.push({
      date: key,
      total: daySales.reduce((sum, s) => sum + saleTotal(s), 0),
    });
  }

  const weekRevenue = last7.reduce((s, d) => s + d.total, 0);

  const prevWeekStart = new Date(today);
  prevWeekStart.setDate(prevWeekStart.getDate() - 13);
  const prevWeekEnd = new Date(today);
  prevWeekEnd.setDate(prevWeekEnd.getDate() - 7);
  let prevWeekRevenue = 0;
  for (const sale of sales) {
    const raw = saleDateIso(sale);
    if (!raw) continue;
    const d = startOfDay(new Date(raw));
    if (d >= prevWeekStart && d < prevWeekEnd) {
      prevWeekRevenue += saleTotal(sale);
    }
  }

  const weekGrowthPercent =
    prevWeekRevenue > 0
      ? Math.round(((weekRevenue - prevWeekRevenue) / prevWeekRevenue) * 100)
      : weekRevenue > 0
        ? 100
        : null;

  const avgDailyRevenue = weekRevenue / 7;
  const projectedMonthRevenue = Math.round(avgDailyRevenue * 30);

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthToDateRevenue = sales
    .filter((s) => {
      const raw = saleDateIso(s);
      if (!raw) return false;
      const d = new Date(raw);
      return !Number.isNaN(d.getTime()) && d >= monthStart;
    })
    .reduce((sum, s) => sum + saleTotal(s), 0);

  const monthlyTarget = settings.monthlyRevenueTarget;
  const targetProgressPercent =
    monthlyTarget && monthlyTarget > 0
      ? Math.min(100, Math.round((monthToDateRevenue / monthlyTarget) * 100))
      : null;

  const productMap = new Map<string, ProductInsight>();
  for (const sale of sales) {
    for (const item of sale.items || []) {
      const name = item.name || item.product_name || "Produit";
      const qty = Number(item.quantity || 0);
      const line =
        Number(item.line_total) ||
        qty * Number(item.unit_price || 0);
      const existing = productMap.get(name) || { name, revenue: 0, quantity: 0 };
      existing.revenue += line;
      existing.quantity += qty;
      productMap.set(name, existing);
    }
  }
  const topProducts = [...productMap.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const clientRevenue = new Map<string, { purchases: number; revenue: number }>();
  for (const sale of sales) {
    const key = sale.client_id || sale.client_phone;
    if (!key) continue;
    const cur = clientRevenue.get(key) || { purchases: 0, revenue: 0 };
    cur.purchases += 1;
    cur.revenue += saleTotal(sale);
    clientRevenue.set(key, cur);
  }

  const topClients: ClientInsight[] = clients
    .map((c) => {
      const stats =
        clientRevenue.get(c.id) ||
        (c.phone ? clientRevenue.get(c.phone) : undefined) || {
          purchases: 0,
          revenue: 0,
        };
      return {
        id: c.id,
        name: c.name,
        phone: c.phone || "",
        status: c.status || "prospect",
        purchases: stats.purchases,
        revenue: stats.revenue,
      };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const totalSales = sales.length;
  const totalRevenue = sales.reduce((s, sale) => s + saleTotal(sale), 0);
  const avgBasket = totalSales > 0 ? totalRevenue / totalSales : 0;

  const stockValue = products.reduce(
    (sum, p) => sum + p.price * Math.max(0, p.stock),
    0
  );
  const outOfStockCount = products.filter((p) => p.stock <= 0).length;
  const lowStockCount = products.filter(
    (p) => p.stock > 0 && p.stock <= threshold
  ).length;

  const activeClients = clients.filter((c) => c.status === "active").length;
  const crmActiveRate =
    clients.length > 0 ? Math.round((activeClients / clients.length) * 100) : 0;

  const recommendations: string[] = [];
  if (typeof window !== "undefined") {
    const actions = computeDailyActions({ limit: 5 });
    recommendations.push(...dailyActionsToRecommendationLines(actions));
  }
  if (recommendations.length === 0) {
    if (outOfStockCount > 0) {
      recommendations.push(
        `${outOfStockCount} produit(s) en rupture — planifiez un réapprovisionnement urgent.`
      );
    }
    if (lowStockCount > 0) {
      recommendations.push(
        `${lowStockCount} produit(s) sous le seuil (${threshold} unités) — vérifiez vos commandes fournisseurs.`
      );
    }
    if (weekGrowthPercent != null && weekGrowthPercent < 0) {
      recommendations.push(
        `CA en baisse de ${Math.abs(weekGrowthPercent)}% vs la semaine précédente — relancez vos clients VIP.`
      );
    } else if (weekGrowthPercent != null && weekGrowthPercent >= 15) {
      recommendations.push(
        `Belle dynamique (+${weekGrowthPercent}% sur 7 jours) — renforcez le stock des best-sellers.`
      );
    }
    if (monthlyTarget && targetProgressPercent != null && targetProgressPercent < 50) {
      const dayOfMonth = today.getDate();
      if (dayOfMonth > 15) {
        recommendations.push(
          `Objectif mensuel à ${targetProgressPercent}% — intensifiez les ventes et relances CRM.`
        );
      }
    }
    if (clients.length > 0 && crmActiveRate < 40) {
      recommendations.push(
        `Seulement ${crmActiveRate}% de clients actifs — utilisez WhatsApp pour réactiver vos prospects.`
      );
    }
    if (recommendations.length === 0) {
      recommendations.push(
        "Activité stable. Consultez vos analytics et exportez le rapport hebdo pour votre équipe."
      );
    }
  }

  return {
    last7Days: last7,
    weekRevenue,
    prevWeekRevenue,
    weekGrowthPercent,
    avgDailyRevenue,
    projectedMonthRevenue,
    monthToDateRevenue,
    monthlyTarget,
    targetProgressPercent,
    topProducts,
    topClients,
    totalSales,
    avgBasket,
    stockValue,
    lowStockCount,
    outOfStockCount,
    crmTotal: clients.length,
    crmActiveRate,
    recommendations,
  };
}
