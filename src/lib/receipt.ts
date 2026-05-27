import type { Sale, SaleItem, Store } from "@/types";
import { formatCurrency } from "./utils";

export async function generateReceiptPdf(
  store: Store,
  sale: Sale,
  items: SaleItem[]
): Promise<Blob> {
  const { jsPDF } = await import("jspdf");

  const doc = new jsPDF({ unit: "mm", format: [80, 200] });
  let y = 8;

  doc.setFontSize(12);
  doc.text(store.name, 40, y, { align: "center" });
  y += 6;
  doc.setFontSize(8);
  doc.text(new Date(sale.created_at || Date.now()).toLocaleString(), 40, y, {
    align: "center",
  });
  y += 8;

  doc.setFontSize(9);
  for (const item of items) {
    doc.text(`${item.product_name} x${item.quantity}`, 4, y);
    y += 4;
    doc.text(formatCurrency(item.subtotal), 76, y, { align: "right" });
    y += 5;
  }

  y += 2;
  doc.setFontSize(11);
  doc.text(`TOTAL: ${formatCurrency(sale.total_amount)}`, 40, y, {
    align: "center",
  });
  y += 6;
  doc.setFontSize(7);
  doc.text("Merci — Wazo Digital", 40, y, { align: "center" });

  return doc.output("blob");
}

export async function shareReceiptWhatsApp(
  phone: string,
  storeName: string,
  total: number
) {
  const message = `Reçu ${storeName} — Total: ${formatCurrency(total)}. Merci pour votre achat!`;
  const url = `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank");
}
