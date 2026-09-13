import { NextResponse } from "next/server";
import { addDays } from "@/lib/billing";
import { authorizeCron } from "@/lib/cron-auth";
import { confirmPaydunyaInvoice, extractPaydunyaInvoiceToken, getPaymentMode } from "@/lib/paydunya";
import { notifyStoreSubscribers } from "@/lib/push-server";
import { fulfillPendingSalePayment, type SaleCheckoutPayload } from "@/lib/sale-payment";
import { createServiceSupabase } from "@/lib/supabase/server";

export const maxDuration = 60;

const STALE_MS = 48 * 60 * 60 * 1000;

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const db = await createServiceSupabase();
  const mode = getPaymentMode();
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const now = new Date().toISOString();

  let salesOk = 0;
  let salesExpired = 0;
  let billingOk = 0;
  let billingExpired = 0;

  const { data: sales } = await db
    .from("sale_payments")
    .select("id,store_id,amount,sale_payload,provider_tx_id,payload,created_at")
    .eq("status", "pending")
    .gte("created_at", since)
    .limit(40);

  for (const payment of sales || []) {
    const stored =
      payment.payload && typeof payment.payload === "object"
        ? (payment.payload as Record<string, unknown>)
        : {};
    const token = extractPaydunyaInvoiceToken(stored);
    if (token) {
      const confirm = await confirmPaydunyaInvoice(token, mode);
      if (confirm.ok) {
        const fulfilled = await fulfillPendingSalePayment(db, {
          storeId: payment.store_id,
          salePayload: payment.sale_payload as SaleCheckoutPayload,
          providerTxId: payment.provider_tx_id,
        });
        if ("saleId" in fulfilled) {
          const items = (payment.sale_payload as SaleCheckoutPayload)?.items || [];
          await notifyStoreSubscribers(db, payment.store_id, {
            title: "Paiement MoMo reçu",
            body: `${items[0]?.name || "Produit"} — ${Number(payment.amount) || 0} FCFA`,
            url: "/sales",
          });
          salesOk += 1;
          continue;
        }
      }
    }
    const age = Date.now() - new Date(payment.created_at).getTime();
    if (age > STALE_MS) {
      await db
        .from("sale_payments")
        .update({ status: "cancelled", updated_at: now })
        .eq("id", payment.id);
      salesExpired += 1;
    }
  }

  const { data: bills } = await db
    .from("billing_payments")
    .select("id,store_id,plan,provider,payload,created_at")
    .eq("status", "pending")
    .gte("created_at", since)
    .limit(40);

  for (const payment of bills || []) {
    const stored =
      payment.payload && typeof payment.payload === "object"
        ? (payment.payload as Record<string, unknown>)
        : {};
    const token = extractPaydunyaInvoiceToken(stored);
    if (token) {
      const confirm = await confirmPaydunyaInvoice(token, mode);
      if (confirm.ok) {
        const paidAt = new Date().toISOString();
        await db
          .from("billing_payments")
          .update({ status: "succeeded", updated_at: paidAt })
          .eq("id", payment.id);
        const periodEnd = addDays(paidAt.slice(0, 10), 30);
        await db.from("billing_subscriptions").upsert(
          {
            store_id: payment.store_id,
            plan: payment.plan,
            status: "active",
            current_period_end: periodEnd,
            last_payment_at: paidAt,
            provider: payment.provider,
            updated_at: paidAt,
          },
          { onConflict: "store_id" }
        );
        billingOk += 1;
        continue;
      }
    }
    const age = Date.now() - new Date(payment.created_at).getTime();
    if (age > STALE_MS) {
      await db
        .from("billing_payments")
        .update({ status: "failed", updated_at: now })
        .eq("id", payment.id);
      billingExpired += 1;
    }
  }

  return NextResponse.json({
    success: true,
    salesOk,
    salesExpired,
    billingOk,
    billingExpired,
  });
}
