import type { SupabaseClient } from "@supabase/supabase-js";
import { replaceSaleItems, saleItemProductId, upsertSaleByExternalId } from "@/lib/sale-cloud";

export type SaleCheckoutItem = {
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

export type SaleCheckoutPayload = {
  external_local_id: string;
  items: SaleCheckoutItem[];
  total: number;
  payment_method: string;
};

export async function fulfillPendingSalePayment(
  supabase: SupabaseClient,
  args: {
    storeId: string;
    salePayload: SaleCheckoutPayload;
    providerTxId: string;
  }
): Promise<{ saleId: string } | { error: string }> {
  const { storeId, salePayload, providerTxId } = args;
  const externalId = salePayload.external_local_id?.trim();
  if (!externalId) return { error: "external_local_id manquant." };
  if (!Array.isArray(salePayload.items) || !salePayload.items.length) {
    return { error: "Panier vide." };
  }

  const total = Number(salePayload.total ?? 0);
  if (!Number.isFinite(total) || total <= 0) return { error: "Montant invalide." };

  const result = await upsertSaleByExternalId(supabase, storeId, {
    total_amount: total,
    total,
    payment_method: salePayload.payment_method || "momo",
    payment_status: "completed",
    external_local_id: externalId,
  });
  if ("error" in result) return { error: result.error };

  const itemsResult = await replaceSaleItems(
    supabase,
    result.id,
    salePayload.items.map((i) => ({
      product_id: saleItemProductId(i.product_id),
      product_name: i.name || "Produit",
      quantity: Number(i.quantity ?? 1),
      unit_price: Number(i.unit_price ?? 0),
      subtotal: Number(i.line_total ?? 0),
    }))
  );
  if ("error" in itemsResult) return { error: itemsResult.error };

  for (const i of salePayload.items) {
    const productId = saleItemProductId(i.product_id);
    if (!productId) continue;
    const qty = Number(i.quantity ?? 1);
    const { data: product } = await supabase
      .from("products")
      .select("stock")
      .eq("id", productId)
      .eq("store_id", storeId)
      .maybeSingle();
    if (product) {
      await supabase
        .from("products")
        .update({ stock: Math.max(0, Number(product.stock) - qty) })
        .eq("id", productId)
        .eq("store_id", storeId);
    }
  }

  const now = new Date().toISOString();
  await supabase
    .from("sale_payments")
    .update({
      status: "succeeded",
      sale_id: result.id,
      updated_at: now,
    })
    .eq("provider_tx_id", providerTxId);

  return { saleId: result.id };
}
