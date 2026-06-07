import { apiFetch } from "@/lib/api-client";
import { getLowStockThreshold } from "@/lib/business-settings";
import { downloadSimplePdf } from "@/lib/export";
import { localStore } from "@/lib/db";
import { readLocalProducts } from "@/lib/local-products";
import { readLocalSales as readSalesForStore } from "@/lib/local-sales";
import { formatCurrency } from "@/lib/utils";

interface LocalSale {
  total?: number;
  total_amount?: number;
  created_at?: string;
  date?: string;
  payment_method?: string;
}

interface BillingPaymentRow {
  amount: number;
  status: string;
  plan: string;
  created_at: string | null;
  provider_tx_id: string | null;
}

function readLocalSales(): LocalSale[] {
  if (typeof window === "undefined") return [];
  return readSalesForStore(localStore.get()?.id);
}

function getWeekRange() {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(end.getDate() - 6);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

async function fetchPaymentsLast7Days(): Promise<BillingPaymentRow[]> {
  try {
    const response = await apiFetch("/api/billing/payments?limit=100", { cache: "no-store" });
    const data = (await response.json()) as {
      success?: boolean;
      payments?: BillingPaymentRow[];
    };
    if (!response.ok || !data.success || !data.payments) return [];
    const { start } = getWeekRange();
    return data.payments.filter((p) => {
      if (!p.created_at) return false;
      return new Date(p.created_at) >= start;
    });
  } catch {
    return [];
  }
}

export async function downloadWeeklyReportPdf(storeName: string) {
  const { start, end } = getWeekRange();
  const periodLabel = `${start.toISOString().slice(0, 10)} → ${end.toISOString().slice(0, 10)}`;
  const products = readLocalProducts();
  const sales = readLocalSales().filter((sale) => {
    const at = sale.created_at || sale.date;
    if (!at) return false;
    const d = new Date(at);
    return d >= start && d <= end;
  });

  const salesTotal = sales.reduce((sum, s) => sum + Number(s.total ?? s.total_amount ?? 0), 0);
  const salesByDay = new Map<string, number>();
  for (const sale of sales) {
    const at = sale.created_at || sale.date;
    if (!at) continue;
    const day = new Date(at).toISOString().slice(0, 10);
    salesByDay.set(day, (salesByDay.get(day) || 0) + Number(sale.total ?? sale.total_amount ?? 0));
  }
  const dayLines = [...salesByDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, total]) => `- ${day}: ${formatCurrency(total)}`);

  const stockThreshold = getLowStockThreshold();
  const outOfStock = products.filter((p) => p.stock <= 0).length;
  const lowStock = products.filter((p) => p.stock > 0 && p.stock <= stockThreshold).length;
  const lowStockNames = products
    .filter((p) => p.stock > 0 && p.stock <= stockThreshold)
    .slice(0, 10)
    .map((p) => `- ${p.name}: ${p.stock} unité(s)`);

  const payments = await fetchPaymentsLast7Days();
  const succeeded = payments.filter((p) => p.status === "succeeded");
  const paymentsTotal = succeeded.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const lines = [
    `Boutique: ${storeName}`,
    `Période: ${periodLabel}`,
    `Généré le: ${new Date().toLocaleString("fr-FR")}`,
    "",
    "=== VENTES ===",
    `Nombre de ventes: ${sales.length}`,
    `Chiffre d'affaires: ${formatCurrency(salesTotal)}`,
    `Panier moyen: ${formatCurrency(sales.length ? salesTotal / sales.length : 0)}`,
    "",
    "CA par jour:",
    ...(dayLines.length ? dayLines : ["- Aucune vente sur la période"]),
    "",
    "=== STOCK ===",
    `Produits catalogués: ${products.length}`,
    `Ruptures (stock 0): ${outOfStock}`,
    `Stock faible (seuil: ${stockThreshold}): ${lowStock}`,
    ...(lowStockNames.length ? ["", "Produits à réapprovisionner:", ...lowStockNames] : []),
    "",
    "=== PAIEMENTS ABONNEMENT ===",
    `Transactions (7 j): ${payments.length}`,
    `Paiements réussis: ${succeeded.length}`,
    `Montant encaissé: ${formatCurrency(paymentsTotal)}`,
    ...payments.slice(0, 15).map(
      (p) =>
        `- ${p.created_at ? new Date(p.created_at).toLocaleDateString("fr-FR") : "?"} | ${p.status} | ${formatCurrency(Number(p.amount))} | plan ${p.plan}`
    ),
    "",
    "— Rapport Wazo Digital",
  ];

  await downloadSimplePdf(
    `Rapport hebdomadaire — ${storeName}`,
    lines,
    `rapport-hebdo-${end.toISOString().slice(0, 10)}.pdf`
  );
}
