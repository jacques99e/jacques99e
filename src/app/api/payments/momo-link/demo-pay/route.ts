import { NextRequest, NextResponse } from "next/server";
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
      .select("id, payload")
      .eq("provider_tx_id", txId)
      .maybeSingle();

    if (error || !payment) {
      return NextResponse.json({ success: false, error: "Paiement introuvable." }, { status: 404 });
    }

    const payload = (payment.payload ?? {}) as { source?: string };
    if (payload.source !== "momo_link") {
      return NextResponse.json({ success: false, error: "Type de paiement invalide." }, { status: 400 });
    }

    const now = new Date().toISOString();
    await supabase
      .from("billing_payments")
      .update({ status: "succeeded", updated_at: now })
      .eq("id", payment.id);

    return NextResponse.json({ success: true, status: "succeeded", transaction_id: txId });
  } catch {
    return NextResponse.json({ success: false, error: "Erreur simulation." }, { status: 500 });
  }
}
