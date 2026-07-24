import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/api-auth";
import { fulfillPendingSalePayment, type SaleCheckoutPayload } from "@/lib/sale-payment";
import { createServiceSupabase } from "@/lib/supabase/server";

/**
 * Poll sale MoMo payment status after PayDunya return.
 * GET ?tx=SALE-...
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthContext();
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const tx = request.nextUrl.searchParams.get("tx")?.trim();
    if (!tx) {
      return NextResponse.json({ success: false, error: "tx requis." }, { status: 400 });
    }

    const db = await createServiceSupabase();
    const { data: payment, error } = await db
      .from("sale_payments")
      .select("id,store_id,user_id,amount,status,sale_payload,sale_id,provider_tx_id")
      .eq("provider_tx_id", tx)
      .maybeSingle();

    if (error || !payment) {
      return NextResponse.json({ success: false, error: "Paiement introuvable." }, { status: 404 });
    }

    if (payment.user_id && payment.user_id !== auth.userId) {
      const { data: store } = await db
        .from("stores")
        .select("owner_id")
        .eq("id", payment.store_id)
        .maybeSingle();
      if (store?.owner_id !== auth.userId) {
        return NextResponse.json({ success: false, error: "Accès refusé." }, { status: 403 });
      }
    }

    if (payment.status === "succeeded" && !payment.sale_id) {
      const payload = payment.sale_payload as SaleCheckoutPayload;
      const fulfilled = await fulfillPendingSalePayment(db, {
        storeId: payment.store_id,
        salePayload: payload,
        providerTxId: payment.provider_tx_id,
      });
      if ("saleId" in fulfilled) {
        return NextResponse.json({
          success: true,
          status: "succeeded",
          transaction_id: tx,
          sale_id: fulfilled.saleId,
          amount: payment.amount,
          sale_payload: payment.sale_payload,
        });
      }
    }

    return NextResponse.json({
      success: true,
      status: payment.status,
      transaction_id: tx,
      sale_id: payment.sale_id,
      amount: payment.amount,
      sale_payload: payment.sale_payload,
    });
  } catch {
    return NextResponse.json({ success: false, error: "Erreur statut paiement." }, { status: 500 });
  }
}
