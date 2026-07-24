import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

import { checkStoreAccess, requireAuthContext } from "@/lib/api-auth";
import {
  getPaymentMode,
  getPaydunyaCheckoutCreateUrl,
  hasPaydunyaCredentials,
  validatePaydunyaKeys,
} from "@/lib/paydunya";
import {
  fulfillPendingSalePayment,
  type SaleCheckoutItem,
  type SaleCheckoutPayload,
} from "@/lib/sale-payment";
import { createServiceSupabase } from "@/lib/supabase/server";

/**
 * Mobile Money checkout for cashier sales (not subscription billing).
 * POST { store_id, amount, items, external_local_id?, phone? }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthContext();
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    // Writes must use service role — user client is subject to RLS.
    const db = await createServiceSupabase();

    const body = (await request.json()) as {
      store_id?: string;
      amount?: number;
      phone?: string;
      external_local_id?: string;
      items?: SaleCheckoutItem[];
    };

    const amount = Number(body.amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ success: false, error: "Montant invalide." }, { status: 400 });
    }
    const amountXof = Math.round(amount);
    // PayDunya live rejects below 200 XOF (error 4003).
    if (amountXof < 200) {
      return NextResponse.json(
        { success: false, error: "Montant minimum Mobile Money : 200 FCFA." },
        { status: 400 }
      );
    }

    const items = Array.isArray(body.items) ? body.items : [];
    if (!items.length) {
      return NextResponse.json({ success: false, error: "Panier vide." }, { status: 400 });
    }

    const { data: ownedStore } = await db
      .from("stores")
      .select("id")
      .eq("owner_id", auth.userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const resolvedStoreId = body.store_id?.trim() || ownedStore?.id;
    if (!resolvedStoreId) {
      return NextResponse.json(
        { success: false, error: "Aucune boutique associée à ce compte." },
        { status: 404 }
      );
    }

    const access = await checkStoreAccess(db, auth.userId, resolvedStoreId, "write");
    if (!access.ok) {
      return NextResponse.json(
        { success: false, error: access.error ?? "Accès refusé." },
        { status: access.status ?? 403 }
      );
    }

    const externalLocalId =
      body.external_local_id?.trim() || `sale-${crypto.randomUUID()}`;
    const salePayload: SaleCheckoutPayload = {
      external_local_id: externalLocalId,
      items: items.map((i) => ({
        product_id: String(i.product_id),
        name: String(i.name || "Produit"),
        quantity: Number(i.quantity || 1),
        unit_price: Number(i.unit_price || 0),
        line_total: Number(i.line_total || Number(i.quantity || 1) * Number(i.unit_price || 0)),
      })),
      total: amountXof,
      payment_method: "momo",
    };

    const provider = process.env.PAYMENT_PROVIDER || "paydunya";
    const mode = getPaymentMode();
    const transactionId = `SALE-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    const { error: insertError } = await db.from("sale_payments").insert({
      store_id: resolvedStoreId,
      user_id: auth.userId,
      amount: amountXof,
      currency: "XOF",
      method: "momo",
      provider,
      provider_tx_id: transactionId,
      status: "pending",
      sale_payload: salePayload,
      payload: { phone: body.phone || null, source: "caisse" },
      updated_at: now,
    });

    if (insertError) {
      const raw = insertError.message ?? "";
      const code = insertError.code ?? "";
      const missingTable =
        /sale_payments/i.test(raw) &&
        (/schema cache/i.test(raw) || /does not exist/i.test(raw) || /could not find/i.test(raw));
      return NextResponse.json(
        {
          success: false,
          error: missingTable
            ? "Table sale_payments introuvable côté API (schema cache). Dans Supabase: Settings → API → Reload schema, ou réexécutez 020_sale_payments.sql."
            : `Impossible d'enregistrer le paiement. ${raw}`,
          supabase_code: code || undefined,
          supabase_hint: insertError.hint || undefined,
        },
        { status: 500 }
      );
    }

    if (mode === "simulate" || !process.env.PAYMENT_API_KEY) {
      const fulfilled = await fulfillPendingSalePayment(db, {
        storeId: resolvedStoreId,
        salePayload,
        providerTxId: transactionId,
      });
      if ("error" in fulfilled) {
        return NextResponse.json({ success: false, error: fulfilled.error }, { status: 500 });
      }
      return NextResponse.json({
        success: true,
        transaction_id: transactionId,
        status: "succeeded",
        sale_id: fulfilled.saleId,
        external_local_id: externalLocalId,
        amount: amountXof,
        payment_environment: mode === "simulate" ? "simulate" : "simulate_no_key",
        message: "Paiement MoMo simulé — vente enregistrée.",
      });
    }

    if (provider !== "paydunya") {
      return NextResponse.json(
        { success: false, error: "Seul PayDunya est supporté pour la caisse MoMo." },
        { status: 400 }
      );
    }

    const keyError = validatePaydunyaKeys();
    if (keyError || !hasPaydunyaCredentials()) {
      return NextResponse.json(
        {
          success: false,
          error: keyError || "Clés PayDunya incomplètes.",
        },
        { status: 400 }
      );
    }

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://app.wazo-digital.com").replace(
      /\/$/,
      ""
    );
    const callbackSecret = process.env.PAYMENT_CALLBACK_SECRET?.trim() ?? "";
    const isProd =
      process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
    if (isProd && !callbackSecret) {
      return NextResponse.json(
        {
          success: false,
          error: "PAYMENT_CALLBACK_SECRET manquant en production.",
        },
        { status: 503 }
      );
    }

    const callbackQuery = new URLSearchParams({ tx: transactionId, kind: "sale" });
    if (callbackSecret) callbackQuery.set("secret", callbackSecret);
    const callbackUrl = `${appUrl}/api/payments/momo/callback?${callbackQuery.toString()}`;

    const checkoutUrl = getPaydunyaCheckoutCreateUrl(mode);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    let res: Response;
    try {
      res = await fetch(checkoutUrl, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "PAYDUNYA-MASTER-KEY": process.env.PAYMENT_API_KEY || "",
          "PAYDUNYA-PRIVATE-KEY": process.env.PAYMENT_SECRET_KEY || "",
          "PAYDUNYA-TOKEN": process.env.PAYMENT_TOKEN || "",
        },
        body: JSON.stringify({
          invoice: {
            total_amount: amountXof,
            description: `Wazo Caisse MoMo — ${amountXof} FCFA`,
          },
          store: { name: "Wazo Digital" },
          custom_data: {
            wazo_tx: transactionId,
            kind: "sale",
            store_id: resolvedStoreId,
          },
          actions: {
            callback_url: callbackUrl,
            return_url: `${appUrl}/sales?tx=${encodeURIComponent(transactionId)}&momo=1`,
            cancel_url: `${appUrl}/sales?tx=${encodeURIComponent(transactionId)}&momo=1&status=cancelled`,
          },
        }),
      });
    } catch (err) {
      const msg =
        err instanceof Error && err.name === "AbortError"
          ? "PayDunya ne répond pas (délai dépassé)."
          : "Impossible de joindre PayDunya.";
      return NextResponse.json({ success: false, error: msg }, { status: 502 });
    } finally {
      clearTimeout(timeout);
    }

    const rawBody = await res.text();
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { success: false, error: "Réponse PayDunya illisible." },
        { status: 502 }
      );
    }

    await db
      .from("sale_payments")
      .update({ payload: data, updated_at: new Date().toISOString() })
      .eq("provider_tx_id", transactionId);

    const checkoutLink =
      typeof data.response_text === "string" && data.response_text.startsWith("http")
        ? data.response_text
        : typeof data.url === "string"
          ? data.url
          : null;

    if (data.response_code !== "00" || !checkoutLink) {
      await db
        .from("sale_payments")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("provider_tx_id", transactionId);
      return NextResponse.json(
        {
          success: false,
          error:
            (typeof data.response_text === "string" && !data.response_text.startsWith("http")
              ? data.response_text
              : null) ||
            (typeof data.description === "string" ? data.description : null) ||
            "PayDunya a refusé la facture.",
        },
        { status: 402 }
      );
    }

    return NextResponse.json({
      success: true,
      transaction_id: transactionId,
      status: "pending",
      checkout_url: checkoutLink,
      external_local_id: externalLocalId,
      amount: amountXof,
      payment_environment: mode === "live" ? "paydunya_live" : "paydunya_test",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur paiement caisse.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
