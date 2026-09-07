import { NextRequest, NextResponse } from "next/server";
import { confirmPaydunyaInvoice, getPaymentMode } from "@/lib/paydunya";
import { allowIp } from "@/lib/rate-limit";
import { notifyStoreSubscribers } from "@/lib/push-server";
import { fulfillPendingSalePayment, type SaleCheckoutPayload } from "@/lib/sale-payment";
import { createServiceSupabase } from "@/lib/supabase/server";
import { isSafeStoreSlug } from "@/lib/utils";

function extractInvoiceToken(payload: Record<string, unknown>): string | null {
  const direct = payload.token ?? payload.invoice_token;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const paydunya = payload.paydunya;
  if (paydunya && typeof paydunya === "object") {
    const nested = (paydunya as { token?: unknown }).token;
    if (typeof nested === "string" && nested.trim()) return nested.trim();
  }
  const invoice = payload.invoice;
  if (invoice && typeof invoice === "object") {
    const nested = (invoice as { token?: unknown }).token;
    if (typeof nested === "string" && nested.trim()) return nested.trim();
  }
  return null;
}

function publicView(
  status: string,
  amount: number,
  productName: string | null,
  tx: string
) {
  return {
    success: true,
    status,
    amount,
    product_name: productName,
    transaction_id: tx,
  };
}

/**
 * Statut public d'un paiement boutique (le client revient de PayDunya).
 * GET ?tx=SALE-...&slug=...
 * Ne révèle rien d'une autre boutique.
 */
export async function GET(request: NextRequest) {
  if (!allowIp(request, "boutique-pay-status", 40, 60 * 1000)) {
    return NextResponse.json(
      { success: false, error: "Trop de requêtes. Réessayez plus tard." },
      { status: 429 }
    );
  }

  const tx = request.nextUrl.searchParams.get("tx")?.trim() || "";
  const slug = (request.nextUrl.searchParams.get("slug") || "").trim().toLowerCase();
  const cancelled = request.nextUrl.searchParams.get("status") === "cancelled";

  if (!tx.startsWith("SALE-") || tx.length > 80 || !isSafeStoreSlug(slug)) {
    return NextResponse.json({ success: false, error: "Paiement introuvable." }, { status: 400 });
  }

  const db = await createServiceSupabase();
  const { data: store } = await db
    .from("stores")
    .select("id")
    .eq("slug", slug)
    .eq("is_public", true)
    .maybeSingle();

  if (!store) {
    return NextResponse.json({ success: false, error: "Boutique introuvable." }, { status: 404 });
  }

  const { data: payment, error } = await db
    .from("sale_payments")
    .select("id,store_id,amount,status,sale_payload,sale_id,provider_tx_id,payload")
    .eq("provider_tx_id", tx)
    .eq("store_id", store.id)
    .maybeSingle();

  if (error || !payment) {
    return NextResponse.json({ success: false, error: "Paiement introuvable." }, { status: 404 });
  }

  const salePayload = payment.sale_payload as SaleCheckoutPayload;
  const productName = salePayload?.items?.[0]?.name || null;
  const amount = Number(payment.amount) || 0;
  const payload = (payment.payload || {}) as Record<string, unknown>;

  if (cancelled && payment.status === "pending") {
    await db
      .from("sale_payments")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", payment.id);
    return NextResponse.json(publicView("cancelled", amount, productName, tx));
  }

  if (payment.status === "succeeded") {
    return NextResponse.json(publicView("succeeded", amount, productName, tx));
  }
  if (payment.status === "failed" || payment.status === "cancelled") {
    return NextResponse.json(publicView(payment.status, amount, productName, tx));
  }

  const token = extractInvoiceToken(payload);
  if (token) {
    const confirm = await confirmPaydunyaInvoice(token, getPaymentMode());
    if (confirm.ok) {
      const fulfilled = await fulfillPendingSalePayment(db, {
        storeId: payment.store_id,
        salePayload,
        providerTxId: payment.provider_tx_id,
      });
      if ("saleId" in fulfilled) {
        await notifyStoreSubscribers(db, payment.store_id, {
          title: "Paiement MoMo reçu",
          body: `${productName || "Produit"} — ${amount} FCFA`,
          url: "/sales",
        });
        return NextResponse.json(publicView("succeeded", amount, productName, tx));
      }
    }
  }

  return NextResponse.json(publicView(payment.status, amount, productName, tx));
}
