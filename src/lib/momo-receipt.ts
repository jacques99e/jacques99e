import { downloadSimplePdf } from "@/lib/export";
import { formatCurrency } from "@/lib/utils";

export interface MomoReceiptData {
  storeName: string;
  label: string;
  reference: string;
  amountFcfa: number;
  status: string;
  customerPhone?: string | null;
  paidAt?: string;
  transactionId?: string;
  saleId?: string | null;
}

export function momoReceiptLines(data: MomoReceiptData): string[] {
  const statusLabel =
    data.status === "succeeded"
      ? "Payé"
      : data.status === "pending"
        ? "En attente"
        : data.status === "failed"
          ? "Échoué"
          : data.status;

  return [
    `Boutique : ${data.storeName}`,
    `Motif : ${data.label}`,
    `Référence : ${data.reference}`,
    `Montant : ${formatCurrency(data.amountFcfa)}`,
    `Statut : ${statusLabel}`,
    data.customerPhone ? `Client : ${data.customerPhone}` : "",
    data.paidAt ? `Date : ${new Date(data.paidAt).toLocaleString("fr-FR")}` : "",
    data.transactionId ? `Transaction : ${data.transactionId}` : "",
    data.saleId ? `Vente caisse : ${data.saleId}` : "",
    "",
    "Paiement sécurisé via PayDunya — Wazo Digital",
  ].filter(Boolean);
}

export async function downloadMomoReceiptPdf(data: MomoReceiptData) {
  await downloadSimplePdf(
    `Reçu MoMo — ${data.reference}`,
    momoReceiptLines(data),
    `momo-${data.reference}.pdf`
  );
}

export function momoHistoryExportRows(
  rows: Array<{
    label: string;
    reference: string;
    amount: number;
    status: string;
    customer_phone?: string | null;
    created_at: string;
    updated_at?: string;
  }>
): Record<string, unknown>[] {
  return rows.map((r) => ({
    Référence: r.reference,
    Motif: r.label,
    Montant: r.amount,
    Statut: r.status,
    Client: r.customer_phone ?? "",
    Créé: r.created_at,
    Mis_à_jour: r.updated_at ?? r.created_at,
  }));
}
