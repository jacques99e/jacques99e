import { NextRequest, NextResponse } from "next/server";
import { createPaydunyaCheckoutInvoice } from "@/lib/paydunya-checkout";
import { getPaymentMode } from "@/lib/paydunya";
import { createServiceSupabase } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ ref: string }> }
) {
  try {
    const { ref } = await context.params;
    const reference = decodeURIComponent(ref).trim();
    if (!reference) {
      return NextResponse.json({ success: false, error: "Référence invalide." }, { status: 400 });
    }

    const supabase = await createServiceSupabase();
    const { data: payment, error } = await supabase
      .from("billing_payments")
      .select("provider_tx_id, status, amount, currency, payload, store_id, created_at")
      .eq("payload->>source", "momo_link")
      .eq("payload->>momo_reference", reference)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !payment) {
      return NextResponse.json({ success: false, error: "Lien introuvable." }, { status: 404 });
    }

    const payload = (payment.payload ?? {}) as {
      label?: string;
      customer_phone?: string;
      paydunya?: Record<string, unknown>;
    };

    const { data: store } = await supabase
      .from("stores")
      .select("name")
      .eq("id", payment.store_id)
      .maybeSingle();

    let checkoutUrl: string | null = null;
    const paydunyaRaw = payload.paydunya;
    if (paydunyaRaw && typeof paydunyaRaw.response_text === "string" && paydunyaRaw.response_text.startsWith("http")) {
      checkoutUrl = paydunyaRaw.response_text;
    }

    if (!checkoutUrl && payment.status === "pending") {
      const publicPath = `/paiement/${encodeURIComponent(reference)}`;
      const returnPath = `${publicPath}?tx=${encodeURIComponent(payment.provider_tx_id)}&status=return`;
      const cancelPath = `${publicPath}?tx=${encodeURIComponent(payment.provider_tx_id)}&status=cancel`;
      const refreshed = await createPaydunyaCheckoutInvoice({
        amount: Number(payment.amount),
        description: `${store?.name || "Boutique"} — ${payload.label || "Paiement"}`,
        storeName: store?.name || "Wazo Digital",
        transactionId: payment.provider_tx_id,
        returnPath,
        cancelPath,
      });
      if (refreshed.ok && refreshed.checkoutUrl) {
        checkoutUrl = refreshed.checkoutUrl;
        await supabase
          .from("billing_payments")
          .update({
            payload: { ...payload, paydunya: refreshed.raw ?? null },
            updated_at: new Date().toISOString(),
          })
          .eq("provider_tx_id", payment.provider_tx_id);
      }
    }

    return NextResponse.json({
      success: true,
      payment: {
        reference,
        transaction_id: payment.provider_tx_id,
        status: payment.status,
        amount: Number(payment.amount),
        currency: payment.currency,
        label: payload.label ?? "Paiement",
        store_name: store?.name ?? "Boutique Wazo",
        checkout_url: payment.status === "pending" ? checkoutUrl : null,
        created_at: payment.created_at,
        simulate_mode: getPaymentMode() === "simulate",
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: "Erreur serveur." }, { status: 500 });
  }
}
