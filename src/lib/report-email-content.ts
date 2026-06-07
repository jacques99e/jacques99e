import { formatCurrency } from "@/lib/utils";

export function buildWeeklyReportEmailContent(params: {
  storeName: string;
  periodLabel: string;
  salesCount: number;
  revenue: number;
  avgBasket: number;
  outOfStock: number;
  lowStock: number;
  lines: string[];
}): { subject: string; html: string; text: string } {
  const { storeName, periodLabel, salesCount, revenue, avgBasket, outOfStock, lowStock, lines } =
    params;

  const subject = `[Wazo] Rapport hebdomadaire — ${storeName}`;
  const text = [
    `Rapport hebdomadaire Wazo Digital`,
    `Boutique: ${storeName}`,
    `Période: ${periodLabel}`,
    ``,
    `Ventes: ${salesCount}`,
    `CA: ${formatCurrency(revenue)}`,
    `Panier moyen: ${formatCurrency(avgBasket)}`,
    `Ruptures: ${outOfStock}`,
    `Stock faible: ${lowStock}`,
    ``,
    ...lines,
    ``,
    `— Envoyé automatiquement chaque lundi`,
  ].join("\n");

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
      <h2 style="color:#075E54">Rapport hebdomadaire</h2>
      <p><strong>${storeName}</strong><br/>${periodLabel}</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr><td>Ventes</td><td style="text-align:right">${salesCount}</td></tr>
        <tr><td>Chiffre d'affaires</td><td style="text-align:right"><strong>${formatCurrency(revenue)}</strong></td></tr>
        <tr><td>Panier moyen</td><td style="text-align:right">${formatCurrency(avgBasket)}</td></tr>
        <tr><td>Ruptures</td><td style="text-align:right">${outOfStock}</td></tr>
        <tr><td>Stock faible</td><td style="text-align:right">${lowStock}</td></tr>
      </table>
      <pre style="background:#f5f5f5;padding:12px;border-radius:8px;font-size:12px;white-space:pre-wrap">${lines.join("\n")}</pre>
      <p style="color:#888;font-size:11px">Envoyé automatiquement chaque lundi par Wazo Digital</p>
    </div>
  `;

  return { subject, html, text };
}
