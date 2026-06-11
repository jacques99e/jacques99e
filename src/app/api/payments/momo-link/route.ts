import { NextRequest, NextResponse } from "next/server";
import { checkStoreAccess, requireAuthContext } from "@/lib/api-auth";
import { createPaydunyaCheckoutInvoice } from "@/lib/paydunya-checkout";
import { getPaymentEnvironmentLabel, getPaymentMode } from "@/lib/paydunya";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthContext();
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const body = (await request.json()) as {
      label?: string;
      amount?: number;
      phone?: string;
      reference?: string;
      local_link_id?: string;
      store_id?: string;
    };

    const label = body.label?.trim();
    const amount = Number(body.amount);
    const phone = body.phone?.trim() ?? "";
    const reference =
      body.reference?.trim() ||
      `WZ${Date.now().toString(36).toUpperCase().slice(-8)}`;

    if (!label) {
      return NextResponse.json({ success: false, error: "Motif requis." }, { status: 400 });
    }
    if (!amount || amount <= 0 || !Number.isFinite(amount)) {
      return NextResponse.json({ success: false, error: "Montant invalide." }, { status: 400 });
    }

    const { data: ownedStore } = await auth.serviceSupabase
      .from("stores")
      .select("id, name")
      .eq("owner_id", auth.userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const storeId = body.store_id ?? ownedStore?.id;
    if (!storeId) {
      return NextResponse.json({ success: false, error: "Boutique introuvable." }, { status: 404 });
    }

    const access = await checkStoreAccess(auth.serviceSupabase, auth.userId, storeId, "write");
    if (!access.ok) {
      return NextResponse.json(
        { success: false, error: access.error ?? "Accès refusé." },
        { status: access.status ?? 403 }
      );
    }

    const { data: storeRow } = await auth.serviceSupabase
      .from("stores")
      .select("name")
      .eq("id", storeId)
      .maybeSingle();

    const storeName = storeRow?.name || "Wazo Digital";
    const transactionId = `WAZO-MOMO-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    const mode = getPaymentMode();
    const appBase = (process.env.NEXT_PUBLIC_APP_URL || "https://wazo-digital.vercel.app").replace(
      /\/$/,
      ""
    );
    const publicPath = `/paiement/${encodeURIComponent(reference)}`;
    const returnPath = `${publicPath}?tx=${encodeURIComponent(transactionId)}&status=return`;
    const cancelPath = `${publicPath}?tx=${encodeURIComponent(transactionId)}&status=cancel`;

    const { error: insertError } = await auth.serviceSupabase.from("billing_payments").insert({
      store_id: storeId,
      user_id: auth.userId,
      plan: "starter",
      amount,
      currency: "XOF",
      method: "momo_link",
      provider: process.env.PAYMENT_PROVIDER || "paydunya",
      provider_tx_id: transactionId,
      status: "pending",
      payload: {
        source: "momo_link",
        momo_reference: reference,
        label,
        customer_phone: phone || null,
        local_link_id: body.local_link_id ?? null,
      },
      updated_at: now,
    });

    if (insertError) {
      return NextResponse.json(
        { success: false, error: `Enregistrement impossible: ${insertError.message}` },
        { status: 500 }
      );
    }

    const checkout = await createPaydunyaCheckoutInvoice({
      amount,
      description: `${storeName} — ${label}`,
      storeName,
      transactionId,
      returnPath,
      cancelPath,
    });

    if (!checkout.ok || !checkout.checkoutUrl) {
      await auth.serviceSupabase
        .from("billing_payments")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("provider_tx_id", transactionId);
      return NextResponse.json(
        { success: false, error: checkout.error ?? "Création facture PayDunya échouée." },
        { status: 502 }
      );
    }

    await auth.serviceSupabase
      .from("billing_payments")
      .update({
        payload: {
          source: "momo_link",
          momo_reference: reference,
          label,
          customer_phone: phone || null,
          local_link_id: body.local_link_id ?? null,
          paydunya: checkout.raw ?? null,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("provider_tx_id", transactionId);

    return NextResponse.json({
      success: true,
      transaction_id: transactionId,
      reference,
      checkout_url: checkout.checkoutUrl,
      public_url: `${appBase}${publicPath}`,
      status: "pending",
      payment_environment: getPaymentEnvironmentLabel(mode),
      paydunya_live: mode === "live",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur lien MoMo.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** Synchronise le statut des liens MoMo (transactions PayDunya). */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthContext();
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const txs =
      request.nextUrl.searchParams.get("transactions")?.split(",").filter(Boolean) ?? [];
    if (!txs.length) {
      return NextResponse.json({ success: false, error: "transactions requis." }, { status: 400 });
    }

    const { data: rows, error } = await auth.serviceSupabase
      .from("billing_payments")
      .select("provider_tx_id, status, amount, payload, updated_at")
      .in("provider_tx_id", txs);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const payments = (rows ?? []).map((row) => ({
      transaction_id: row.provider_tx_id,
      status: row.status,
      amount: row.amount,
      reference:
        row.payload &&
        typeof row.payload === "object" &&
        "momo_reference" in (row.payload as object)
          ? String((row.payload as { momo_reference?: string }).momo_reference ?? "")
          : "",
      updated_at: row.updated_at,
    }));

    return NextResponse.json({ success: true, payments });
  } catch {
    return NextResponse.json({ success: false, error: "Erreur statut." }, { status: 500 });
  }
}
