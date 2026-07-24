import { NextRequest, NextResponse } from "next/server";
import { addDays } from "@/lib/billing";
import { createServiceSupabase } from "@/lib/supabase/server";
import { fulfillPendingSalePayment, type SaleCheckoutPayload } from "@/lib/sale-payment";

function isProductionLike(): boolean {
  return (
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production"
  );
}

function assertCallbackSecret(request: NextRequest): NextResponse | null {
  const callbackSecret = process.env.PAYMENT_CALLBACK_SECRET?.trim();
  if (!callbackSecret) {
    if (isProductionLike()) {
      console.error("[payments/callback] PAYMENT_CALLBACK_SECRET manquant en production");
      return NextResponse.json(
        { success: false, error: "Callback paiement non configure." },
        { status: 503 }
      );
    }
    return null;
  }

  const headerSecret = request.headers.get("x-callback-secret");
  const querySecret = request.nextUrl.searchParams.get("secret");
  const validHeader = Boolean(headerSecret && headerSecret === callbackSecret);
  const validQuery = Boolean(querySecret && querySecret === callbackSecret);
  if (!validHeader && !validQuery) {
    return NextResponse.json(
      { success: false, error: "Signature callback invalide." },
      { status: 401 }
    );
  }
  return null;
}

function extractTransactionId(payload: Record<string, unknown>, fallback: string | null): string | null {
  const direct = payload.transaction_id ?? payload.txid ?? payload.tx ?? payload.cpm_trans_id;
  if (typeof direct === "string" && direct.trim()) return direct.trim();

  const custom = payload.custom_data;
  if (custom && typeof custom === "object") {
    const wazoTx = (custom as Record<string, unknown>).wazo_tx;
    if (typeof wazoTx === "string" && wazoTx.trim()) return wazoTx.trim();
  }

  const data = payload.data;
  if (data && typeof data === "object") {
    const nested = data as Record<string, unknown>;
    const nestedTx = nested.transaction_id ?? nested.wazo_tx;
    if (typeof nestedTx === "string" && nestedTx.trim()) return nestedTx.trim();
    const nestedCustom = nested.custom_data;
    if (nestedCustom && typeof nestedCustom === "object") {
      const wazoTx = (nestedCustom as Record<string, unknown>).wazo_tx;
      if (typeof wazoTx === "string" && wazoTx.trim()) return wazoTx.trim();
    }
  }
  return fallback;
}

function isSuccessfulPayment(payload: Record<string, unknown>): boolean {
  // Empty body + known tx in query: PayDunya sometimes notifies with minimal body.
  // Prefer explicit success markers when present.
  const status = String(payload.status ?? payload.payment_status ?? payload.cpm_result ?? "").toLowerCase();
  if (["success", "succeeded", "paid", "completed", "accepted", "ok"].includes(status)) {
    return true;
  }
  const code = String(payload.code ?? payload.cpm_code ?? payload.response_code ?? "");
  if (code === "00" || code === "201") return true;

  // PayDunya invoice status field
  const invoiceStatus = String(
    (payload as { invoice?: { status?: string } }).invoice?.status ?? ""
  ).toLowerCase();
  if (["completed", "paid"].includes(invoiceStatus)) return true;

  // If payload is empty but we have a query tx, treat as success only when kind=sale
  // is handled by caller with emptyPayloadOk flag — default false for billing safety.
  return false;
}

async function handleSaleCallback(
  serviceSupabase: Awaited<ReturnType<typeof createServiceSupabase>>,
  txId: string,
  payload: Record<string, unknown>,
  emptyPayloadAssumeSuccess: boolean
) {
  const { data: payment, error } = await serviceSupabase
    .from("sale_payments")
    .select("id,store_id,status,sale_payload,sale_id,provider_tx_id")
    .eq("provider_tx_id", txId)
    .maybeSingle();

  if (error || !payment) return null;

  const success =
    isSuccessfulPayment(payload) ||
    (emptyPayloadAssumeSuccess && Object.keys(payload).length === 0);

  const now = new Date().toISOString();

  if (!success) {
    await serviceSupabase
      .from("sale_payments")
      .update({ status: "failed", payload, updated_at: now })
      .eq("id", payment.id);
    return NextResponse.json({
      success: true,
      kind: "sale",
      transaction_id: txId,
      status: "failed",
    });
  }

  if (payment.status === "succeeded" && payment.sale_id) {
    return NextResponse.json({
      success: true,
      kind: "sale",
      transaction_id: txId,
      status: "succeeded",
      sale_id: payment.sale_id,
    });
  }

  await serviceSupabase
    .from("sale_payments")
    .update({ payload, updated_at: now })
    .eq("id", payment.id);

  const fulfilled = await fulfillPendingSalePayment(serviceSupabase, {
    storeId: payment.store_id,
    salePayload: payment.sale_payload as SaleCheckoutPayload,
    providerTxId: payment.provider_tx_id,
  });

  if ("error" in fulfilled) {
    await serviceSupabase
      .from("sale_payments")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", payment.id);
    return NextResponse.json(
      { success: false, kind: "sale", error: fulfilled.error },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    kind: "sale",
    transaction_id: txId,
    status: "succeeded",
    sale_id: fulfilled.saleId,
  });
}

export async function POST(request: NextRequest) {
  try {
    const authError = assertCallbackSecret(request);
    if (authError) return authError;

    const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const fallbackTx = request.nextUrl.searchParams.get("tx");
    const kind = request.nextUrl.searchParams.get("kind");
    const txId = extractTransactionId(payload, fallbackTx);
    if (!txId) {
      return NextResponse.json({ success: false, error: "Transaction introuvable." }, { status: 400 });
    }

    const serviceSupabase = await createServiceSupabase();
    const emptyPayload = Object.keys(payload).length === 0;
    const preferSale = kind === "sale" || txId.startsWith("SALE-");

    if (preferSale) {
      const saleResult = await handleSaleCallback(
        serviceSupabase,
        txId,
        payload,
        emptyPayload
      );
      if (saleResult) return saleResult;
    } else {
      // Try sale table first in case kind missing
      const saleResult = await handleSaleCallback(serviceSupabase, txId, payload, false);
      if (saleResult) return saleResult;
    }

    const { data: payment, error: paymentError } = await serviceSupabase
      .from("billing_payments")
      .select("id,store_id,plan,provider")
      .eq("provider_tx_id", txId)
      .maybeSingle();

    if (paymentError || !payment) {
      return NextResponse.json({ success: false, error: "Paiement inconnu." }, { status: 404 });
    }

    const success = isSuccessfulPayment(payload);
    const now = new Date().toISOString();
    await serviceSupabase
      .from("billing_payments")
      .update({
        status: success ? "succeeded" : "failed",
        payload,
        updated_at: now,
      })
      .eq("id", payment.id);

    if (success) {
      const periodEnd = addDays(new Date().toISOString().slice(0, 10), 30);
      await serviceSupabase.from("billing_subscriptions").upsert(
        {
          store_id: payment.store_id,
          plan: payment.plan,
          status: "active",
          current_period_end: periodEnd,
          last_payment_at: now,
          provider: payment.provider,
          updated_at: now,
        },
        { onConflict: "store_id" }
      );
    }

    return NextResponse.json({
      success: true,
      kind: "billing",
      transaction_id: txId,
      status: success ? "succeeded" : "failed",
    });
  } catch {
    return NextResponse.json({ success: false, error: "Erreur callback paiement." }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const authError = assertCallbackSecret(request);
  if (authError) return authError;

  // PayDunya may ping GET — if tx present, acknowledge
  const tx = request.nextUrl.searchParams.get("tx");
  return NextResponse.json({
    success: true,
    message: "Callback paiement actif.",
    tx: tx || null,
  });
}
