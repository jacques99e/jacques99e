import { downloadSimplePdf } from "@/lib/export";
import { formatCurrency } from "@/lib/utils";

export interface ReconciliationRow {
  reference: string;
  label: string;
  amount: number;
  status: string;
  sale_id: string | null;
  paid_at: string | null;
}

export interface ReconciliationReport {
  storeName: string;
  generatedAt: string;
  rows: ReconciliationRow[];
  totalPaidFcfa: number;
  syncedCount: number;
  missingSaleCount: number;
  pendingCount: number;
}

export function buildReconciliationReport(
  storeName: string,
  payments: ReconciliationRow[]
): ReconciliationReport {
  const paid = payments.filter((p) => p.status === "succeeded");
  const pending = payments.filter((p) => p.status === "pending");
  const synced = paid.filter((p) => p.sale_id);
  const missing = paid.filter((p) => !p.sale_id);

  return {
    storeName,
    generatedAt: new Date().toISOString(),
    rows: payments,
    totalPaidFcfa: paid.reduce((s, p) => s + p.amount, 0),
    syncedCount: synced.length,
    missingSaleCount: missing.length,
    pendingCount: pending.length,
  };
}

export async function downloadMomoReconciliationPdf(report: ReconciliationReport) {
  const lines = [
    `Boutique : ${report.storeName}`,
    `Généré le : ${new Date(report.generatedAt).toLocaleString("fr-FR")}`,
    "",
    `Total encaissé : ${formatCurrency(report.totalPaidFcfa)}`,
    `Payés sync caisse : ${report.syncedCount}`,
    `Payés sans vente caisse : ${report.missingSaleCount}`,
    `En attente : ${report.pendingCount}`,
    "",
    "--- Détail ---",
    ...report.rows.map((r) => {
      const sync = r.status === "succeeded" ? (r.sale_id ? "OK caisse" : "MANQUE vente") : r.status;
      return `${r.reference} | ${r.label} | ${formatCurrency(r.amount)} | ${sync}`;
    }),
  ];

  await downloadSimplePdf(
    `Réconciliation MoMo — ${report.storeName}`,
    lines,
    `momo-reconciliation-${new Date().toISOString().slice(0, 10)}.pdf`
  );
}
