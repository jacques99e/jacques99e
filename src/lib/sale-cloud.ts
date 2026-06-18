import type { SupabaseClient } from "@supabase/supabase-js";

export interface SaleCloudPayload {
  total_amount: number;
  total: number;
  payment_method: string;
  payment_status: string;
  external_local_id: string;
}

export interface SaleItemCloudPayload {
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

function formatError(error: { message: string; code?: string }): string {
  return error.code ? `${error.message} (${error.code})` : error.message;
}

/** Insert or update a sale by store + external_local_id (works with partial or full unique index). */
export async function upsertSaleByExternalId(
  supabase: SupabaseClient,
  storeId: string,
  payload: SaleCloudPayload
): Promise<{ id: string } | { error: string }> {
  const extId = payload.external_local_id?.trim();
  if (!extId) return { error: "external_local_id requis" };

  const { data: existing, error: findError } = await supabase
    .from("sales")
    .select("id")
    .eq("store_id", storeId)
    .eq("external_local_id", extId)
    .maybeSingle();

  if (findError) return { error: formatError(findError) };

  const row = {
    store_id: storeId,
    total_amount: payload.total_amount,
    total: payload.total,
    payment_method: payload.payment_method,
    payment_status: payload.payment_status,
    external_local_id: extId,
  };

  if (existing?.id) {
    const { data, error } = await supabase
      .from("sales")
      .update({
        total_amount: row.total_amount,
        total: row.total,
        payment_method: row.payment_method,
        payment_status: row.payment_status,
      })
      .eq("id", existing.id)
      .select("id")
      .single();
    if (error) return { error: formatError(error) };
    return { id: data.id };
  }

  const { data, error } = await supabase.from("sales").insert(row).select("id").single();
  if (error) return { error: formatError(error) };
  return { id: data.id };
}

export async function replaceSaleItems(
  supabase: SupabaseClient,
  saleId: string,
  items: SaleItemCloudPayload[]
): Promise<{ ok: true } | { error: string }> {
  const { error: delError } = await supabase.from("sale_items").delete().eq("sale_id", saleId);
  if (delError) return { error: formatError(delError) };
  if (!items.length) return { ok: true };

  const { error: insError } = await supabase.from("sale_items").insert(
    items.map((i) => ({
      sale_id: saleId,
      product_id: i.product_id,
      product_name: i.product_name,
      quantity: i.quantity,
      unit_price: i.unit_price,
      subtotal: i.subtotal,
    }))
  );
  if (insError) return { error: formatError(insError) };
  return { ok: true };
}

export function saleItemProductId(raw: string | undefined | null): string | null {
  if (!raw || String(raw).startsWith("local-") || String(raw).startsWith("sale-")) return null;
  return raw;
}
