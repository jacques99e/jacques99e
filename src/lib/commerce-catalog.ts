import { formatCurrency } from "@/lib/utils";
import type { LocalProduct } from "@/lib/local-products";

export function buildWhatsAppCatalog(params: {
  storeName: string;
  products: LocalProduct[];
  boutiqueUrl?: string;
}): string {
  const lines = [`*${params.storeName}* — Catalogue`, ""];
  if (params.boutiqueUrl) {
    lines.push(`Commandez ici : ${params.boutiqueUrl}`, "");
  }
  const items = params.products.slice(0, 15);
  for (const p of items) {
    const stock = p.stock ?? p.stock_quantity ?? 0;
    const avail = stock > 0 ? "dispo" : "rupture";
    lines.push(`• ${p.name} — ${formatCurrency(p.price)} (${avail})`);
  }
  if (params.products.length > 15) {
    lines.push(`… et ${params.products.length - 15} autres produits`);
  }
  return lines.join("\n");
}
