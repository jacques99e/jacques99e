import { NextRequest, NextResponse } from "next/server";
import { addDays } from "@/lib/billing";
import { createServiceSupabase } from "@/lib/supabase/server";

function extractTransactionId(payload: Record<string, unknown>, fallback: string | null): string | null {
  const direct = payload.transaction_id ?? payload.txid ?? payload.tx ?? payload.cpm_trans_id;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const data = payload.data;
  if (data && typeof data === "object") {
    const nested = (data as Record<string, unknown>).transaction_id;
    if (typeof nested === "string" && nested.trim()) return nested.trim();
  }
  return fallback;
}

function isSuccessfulPayment(payload: Record<string, unknown>): boolean {
  const status = String(payload.status ?? payload.payment_status ?? payload.cpm_result ?? "").toLowerCase();
  if (["success", "succeeded", "paid", "completed", "accepted", "ok"].includes(status)) {
    return true;
  }
  const code = String(payload.code ?? payload.cpm_code ?? "");
  return code === "00" || code === "201";
}

export async function POST(request: NextRequest) {
  try {
    const callbackSecret = process.env.PAYMENT_CALLBACK_SECRET;
    if (callbackSecret) {
      const headerSecret = request.headers.get("x-callback-secret");
      const querySecret = request.nextUrl.searchParams.get("secret");
      const validHeader = Boolean(headerSecret && headerSecret === callbackSecret);
      const validQuery = Boolean(querySecret && querySecret === callbackSecret);
      if (!validHeader && !validQuery) {
        return NextResponse.json({ success: false, error: "Signature callback invalide." }, { status: 401 });
      }
    }

    const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const fallbackTx = request.nextUrl.searchParams.get("tx");
    const txId = extractTransactionId(payload, fallbackTx);
    if (!txId) {
      return NextResponse.json({ success: false, error: "Transaction introuvable." }, { status: 400 });
    }

    const serviceSupabase = await createServiceSupabase();
    const { data: payment, error: paymentError } = await serviceSupabase
      .from("billing_payments")
      .select("id,store_id,plan,provider,payload")
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

    const paymentPayload = (payment.payload ?? {}) as { source?: string };
    const isMomoLink = paymentPayload.source === "momo_link";

    if (success && !isMomoLink) {
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

    return NextResponse.json({ success: true, transaction_id: txId, status: success ? "succeeded" : "failed" });
  } catch {
    return NextResponse.json({ success: false, error: "Erreur callback paiement." }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const callbackSecret = process.env.PAYMENT_CALLBACK_SECRET;
  if (callbackSecret) {
    const headerSecret = request.headers.get("x-callback-secret");
    const querySecret = request.nextUrl.searchParams.get("secret");
    const validHeader = Boolean(headerSecret && headerSecret === callbackSecret);
    const validQuery = Boolean(querySecret && querySecret === callbackSecret);
    if (!validHeader && !validQuery) {
      return NextResponse.json({ success: false, error: "Signature callback invalide." }, { status: 401 });
    }
  }

  return NextResponse.json({ success: true, message: "Callback abonnement actif." });
}

