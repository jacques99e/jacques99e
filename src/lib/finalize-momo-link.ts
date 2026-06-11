import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyStoreOnMomoPayment } from "@/lib/momo-notify";
import { syncMomoPaymentToSale } from "@/lib/momo-sale-sync";

export interface MomoPaymentRecord {
  id: string;
  store_id: string;
  amount: number;
  status: string;
  payload: unknown;
  provider_tx_id: string;
}

export async function finalizeMomoLinkPayment(
  supabase: SupabaseClient,
  payment: MomoPaymentRecord,
  extraPayload?: Record<string, unknown>
): Promise<{ alreadyPaid: boolean; saleId: string | null; saleCreated: boolean }> {
  const payload = (payment.payload ?? {}) as {
    label?: string;
    momo_reference?: string;
    customer_phone?: string | null;
    sale_id?: string;
  };

  const alreadyPaid = payment.status === "succeeded";
  const now = new Date().toISOString();
  const mergedPayload = { ...payload, ...extraPayload };

  if (!alreadyPaid) {
    await supabase
      .from("billing_payments")
      .update({
        status: "succeeded",
        payload: { ...mergedPayload, confirmed_at: now },
        updated_at: now,
      })
      .eq("id", payment.id);

    await notifyStoreOnMomoPayment(supabase, {
      storeId: payment.store_id,
      amountFcfa: Number(payment.amount),
      label: payload.label ?? "Paiement MoMo",
      reference: payload.momo_reference ?? payment.provider_tx_id,
      customerPhone: payload.customer_phone,
    });
  }

  const saleResult = await syncMomoPaymentToSale(supabase, {
    storeId: payment.store_id,
    amountFcfa: Number(payment.amount),
    label: payload.label ?? "Paiement MoMo",
    transactionId: payment.provider_tx_id,
    reference: payload.momo_reference,
  });

  if (saleResult.saleId && !payload.sale_id) {
    await supabase
      .from("billing_payments")
      .update({
        payload: {
          ...mergedPayload,
          sale_id: saleResult.saleId,
          sale_synced_at: now,
        },
        updated_at: now,
      })
      .eq("id", payment.id);
  }

  return {
    alreadyPaid,
    saleId: saleResult.saleId,
    saleCreated: saleResult.created,
  };
}
