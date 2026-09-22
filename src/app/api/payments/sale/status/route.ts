import { NextRequest, NextResponse } from "next/server";
import { checkStoreAccess, requireAuthContext } from "@/lib/api-auth";
import { confirmPaydunyaInvoice, extractPaydunyaInvoiceToken, getPaymentMode } from "@/lib/paydunya";
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
      .select("id,store_id,user_id,amount,status,sale_payload,sale_id,provider_tx_id,payload")
      .eq("provider_tx_id", tx)
      .maybeSingle();

    if (error || !payment) {
      return NextResponse.json({ success: false, error: "Paiement introuvable." }, { status: 404 });
    }

    const access = await checkStoreAccess(
      auth.serviceSupabase,
      auth.userId,
      payment.store_id,
      "read"
    );
    if (!access.ok && payment.user_id !== auth.userId) {
      return NextResponse.json({ success: false, error: "Accès refusé." }, { status: 403 });
    }

    if (payment.status === "pending") {
      const stored =
        payment.payload && typeof payment.payload === "object"
          ? (payment.payload as Record<string, unknown>)
          : {};
      const token = extractPaydunyaInvoiceToken(stored);
      if (token) {
        const confirm = await confirmPaydunyaInvoice(token, getPaymentMode());
        if (confirm.ok) {
          const fulfilled = await fulfillPendingSalePayment(db, {
            storeId: payment.store_id,
            salePayload: payment.sale_payload as SaleCheckoutPayload,
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
