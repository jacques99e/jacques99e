import type { SupabaseClient } from "@supabase/supabase-js";

export interface MomoSaleSyncParams {
  storeId: string;
  amountFcfa: number;
  label: string;
  transactionId: string;
  reference?: string;
}

export function momoSaleExternalId(transactionId: string): string {
  return `sale-momo-${transactionId}`;
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

  const total = params.amountFcfa;
  const productName = params.label.trim() || `MoMo ${params.reference || params.transactionId}`;

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
  await supabase.from("sale_items").insert({
    sale_id: saleRow.id,
    product_id: null,
    product_name: productName,
    quantity: 1,
    unit_price: total,
    subtotal: total,
  });

  return { saleId: saleRow.id, created: true };
}
