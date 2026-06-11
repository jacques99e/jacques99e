import { NextRequest, NextResponse } from "next/server";
import { confirmPaydunyaInvoice } from "@/lib/paydunya-checkout";
import { finalizeMomoLinkPayment } from "@/lib/finalize-momo-link";
import { createServiceSupabase } from "@/lib/supabase/server";

/** Confirme un paiement MoMo via token PayDunya (retour client ou webhook). */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      token?: string;
      transaction_id?: string;
    };
    const token = body.token?.trim();
    const transactionId = body.transaction_id?.trim();

    if (!token && !transactionId) {
      return NextResponse.json(
        { success: false, error: "token ou transaction_id requis." },
        { status: 400 }
      );
    }

    const supabase = await createServiceSupabase();
    let payment = null;

    if (transactionId) {
      const { data } = await supabase
        .from("billing_payments")
        .select("id, store_id, amount, status, payload, provider_tx_id")
        .eq("provider_tx_id", transactionId)
        .maybeSingle();
      payment = data;
    }

    if (!payment && token) {
      const { data } = await supabase
        .from("billing_payments")
        .select("id, store_id, amount, status, payload, provider_tx_id")
        .eq("payload->>source", "momo_link")
        .eq("payload->>paydunya_token", token)
        .maybeSingle();
      payment = data;
    }

    if (!payment) {
      return NextResponse.json({ success: false, error: "Paiement introuvable." }, { status: 404 });
    }

    const payload = (payment.payload ?? {}) as { source?: string };
    if (payload.source !== "momo_link") {
      return NextResponse.json({ success: false, error: "Type invalide." }, { status: 400 });
    }

    const confirmToken =
      token ||
      (() => {
        const pl = payment!.payload as { paydunya_token?: string; paydunya?: { token?: string } };
        return pl.paydunya_token || pl.paydunya?.token || null;
      })();

    if (!confirmToken) {
      return NextResponse.json(
        { success: false, error: "Token PayDunya manquant." },
        { status: 400 }
      );
    }

    const confirmed = await confirmPaydunyaInvoice(confirmToken);
    if (!confirmed.ok) {
      return NextResponse.json({
        success: false,
        status: confirmed.status ?? "pending",
        error: confirmed.error ?? "Paiement non confirmé par PayDunya.",
      });
    }

    const result = await finalizeMomoLinkPayment(
      supabase,
      payment,
      {
        paydunya_confirm: confirmed.raw,
        ...(token ? { paydunya: { token } } : {}),
      }
    );

    return NextResponse.json({
      success: true,
      status: "succeeded",
      transaction_id: payment.provider_tx_id,
      already_paid: result.alreadyPaid,
      sale_id: result.saleId,
      sale_created: result.saleCreated,
    });
  } catch {
    return NextResponse.json({ success: false, error: "Erreur confirmation." }, { status: 500 });
  }
}
