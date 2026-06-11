import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/api-auth";
import { checkMomoLinkAccess } from "@/lib/momo-access";
import { resolveMomoStore } from "@/lib/momo-store";
import { looksLikePhone, sendSms } from "@/lib/sms";

function buildMomoReminderSms(params: {
  storeName: string;
  amountFcfa: number;
  label: string;
  reference: string;
  publicUrl: string;
}): string {
  return (
    `Rappel Wazo ${params.storeName}: ${params.amountFcfa.toLocaleString("fr-FR")} FCFA\n` +
    `${params.label}\n` +
    `Ref ${params.reference}\n` +
    `Payer: ${params.publicUrl}`
  );
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthContext();
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const body = (await request.json()) as {
      store_id?: string;
      transaction_id?: string;
      reference?: string;
    };

    const storeResolved = await resolveMomoStore(
      auth.serviceSupabase,
      auth.userId,
      body.store_id,
      "write"
    );
    if (!storeResolved.ok) {
      return NextResponse.json(
        { success: false, error: storeResolved.error },
        { status: storeResolved.status }
      );
    }

    const momoAccess = await checkMomoLinkAccess(
      auth.serviceSupabase,
      auth.userId,
      storeResolved.storeId
    );
    if (!momoAccess.ok) {
      return NextResponse.json(
        { success: false, error: momoAccess.error },
        { status: momoAccess.status ?? 403 }
      );
    }

    let payment = null;
    if (body.transaction_id) {
      const { data } = await auth.serviceSupabase
        .from("billing_payments")
        .select("amount, status, payload, provider_tx_id")
        .eq("store_id", storeResolved.storeId)
        .eq("provider_tx_id", body.transaction_id)
        .maybeSingle();
      payment = data;
    } else if (body.reference) {
      const { data } = await auth.serviceSupabase
        .from("billing_payments")
        .select("amount, status, payload, provider_tx_id")
        .eq("store_id", storeResolved.storeId)
        .eq("payload->>momo_reference", body.reference)
        .maybeSingle();
      payment = data;
    }

    if (!payment) {
      return NextResponse.json({ success: false, error: "Paiement introuvable." }, { status: 404 });
    }

    if (payment.status !== "pending") {
      return NextResponse.json(
        { success: false, error: "Seuls les liens en attente peuvent être relancés." },
        { status: 400 }
      );
    }

    const payload = (payment.payload ?? {}) as {
      label?: string;
      momo_reference?: string;
      customer_phone?: string | null;
    };

    const phone = payload.customer_phone?.trim();
    if (!phone || !looksLikePhone(phone)) {
      return NextResponse.json(
        { success: false, error: "Numéro client invalide ou manquant." },
        { status: 400 }
      );
    }

    const appBase = (process.env.NEXT_PUBLIC_APP_URL || "https://wazo-digital.vercel.app").replace(
      /\/$/,
      ""
    );
    const reference = payload.momo_reference ?? body.reference ?? "";
    const publicUrl = `${appBase}/paiement/${encodeURIComponent(reference)}`;

    const message = buildMomoReminderSms({
      storeName: storeResolved.storeName,
      amountFcfa: Number(payment.amount),
      label: payload.label ?? "Paiement",
      reference,
      publicUrl,
    });

    const sms = await sendSms(phone, message);
    if (!sms.ok) {
      return NextResponse.json({ success: false, error: sms.error }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      simulated: sms.simulated ?? false,
      message: sms.simulated ? "SMS simulé" : "Rappel SMS envoyé au client",
    });
  } catch {
    return NextResponse.json({ success: false, error: "Erreur envoi SMS." }, { status: 500 });
  }
}
