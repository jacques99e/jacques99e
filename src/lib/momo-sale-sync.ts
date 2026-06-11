import type { SupabaseClient } from "@supabase/supabase-js";

export interface MomoSaleLineItem {
  product_id?: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
}

export interface MomoSaleSyncParams {
  storeId: string;
  amountFcfa: number;
  label: string;
  transactionId: string;
  reference?: string;
  items?: MomoSaleLineItem[];
}

export function momoSaleExternalId(transactionId: string): string {
  return `sale-momo-${transactionId}`;
}

async function decrementStock(
  supabase: SupabaseClient,
  productId: string,
  quantity: number
) {
  if (!productId || productId.startsWith("local-") || productId === "momo-link") return;
  const { data: product } = await supabase
    .from("products")
    .select("stock_quantity")
    .eq("id", productId)
    .maybeSingle();
  if (!product) return;
  await supabase
    .from("products")
    .update({
      stock_quantity: Math.max(0, Number(product.stock_quantity) - quantity),
    })
    .eq("id", productId);
}

/** Crée une vente caisse idempotente pour un lien MoMo payé. */
export async function syncMomoPaymentToSale(
  supabase: SupabaseClient,
  params: MomoSaleSyncParams
): Promise<{ saleId: string | null; created: boolean }> {
  const externalLocalId = momoSaleExternalId(params.transactionId);

  const { data: existing } = await supabase
    .from("sales")
    .select("id")
    .eq("store_id", params.storeId)
    .eq("external_local_id", externalLocalId)
    .maybeSingle();

  if (existing?.id) {
    return { saleId: existing.id, created: false };
  }

  const lineItems: MomoSaleLineItem[] =
    params.items?.length
      ? params.items
      : [
          {
            product_name:
              params.label.trim() || `MoMo ${params.reference || params.transactionId}`,
            quantity: 1,
            unit_price: params.amountFcfa,
          },
        ];

  const total = lineItems.reduce((s, i) => s + i.quantity * i.unit_price, 0);

  const { data: saleRow, error } = await supabase
    .from("sales")
    .upsert(
      {
        store_id: params.storeId,
        total_amount: total,
        total,
        payment_method: "momo",
        payment_status: "completed",
        external_local_id: externalLocalId,
      },
      { onConflict: "store_id,external_local_id" }
    )
    .select("id")
    .single();

  if (error || !saleRow) {
    return { saleId: null, created: false };
  }

  await supabase.from("sale_items").delete().eq("sale_id", saleRow.id);
  await supabase.from("sale_items").insert(
    lineItems.map((i) => ({
      sale_id: saleRow.id,
      product_id: i.product_id && !String(i.product_id).startsWith("local-") ? i.product_id : null,
      product_name: i.product_name,
      quantity: i.quantity,
      unit_price: i.unit_price,
      subtotal: i.quantity * i.unit_price,
    }))
  );

  for (const item of lineItems) {
    if (item.product_id) {
      await decrementStock(supabase, item.product_id, item.quantity);
    }
  }

  return { saleId: saleRow.id, created: true };
}
