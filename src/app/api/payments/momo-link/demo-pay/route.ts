import { NextRequest, NextResponse } from "next/server";
import { finalizeMomoLinkPayment } from "@/lib/finalize-momo-link";
import { getPaymentMode } from "@/lib/paydunya";
import { createServiceSupabase } from "@/lib/supabase/server";

/** Confirme un paiement MoMo en mode simulation uniquement. */
export async function POST(request: NextRequest) {
  if (getPaymentMode() !== "simulate") {
    return NextResponse.json(
      { success: false, error: "Disponible uniquement en mode simulation." },
      { status: 403 }
    );
  }

  try {
    const body = (await request.json()) as { transaction_id?: string };
    const txId = body.transaction_id?.trim();
    if (!txId) {
      return NextResponse.json({ success: false, error: "transaction_id requis." }, { status: 400 });
    }

    const supabase = await createServiceSupabase();
    const { data: payment, error } = await supabase
      .from("billing_payments")
      .select("id, store_id, amount, status, payload, provider_tx_id")
      .eq("provider_tx_id", txId)
      .maybeSingle();

    if (error || !payment) {
      return NextResponse.json({ success: false, error: "Paiement introuvable." }, { status: 404 });
    }

    const payload = (payment.payload ?? {}) as { source?: string };
    if (payload.source !== "momo_link") {
      return NextResponse.json({ success: false, error: "Type de paiement invalide." }, { status: 400 });
    }

    const result = await finalizeMomoLinkPayment(supabase, payment, { demo_pay: true });

    return NextResponse.json({
      success: true,
      status: "succeeded",
      transaction_id: txId,
      sale_id: result.saleId,
      sale_created: result.saleCreated,
    });
  } catch {
    return NextResponse.json({ success: false, error: "Erreur simulation." }, { status: 500 });
  }
}
