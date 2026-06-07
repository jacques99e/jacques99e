import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;
import { checkStoreAccess, requireAuthContext } from "@/lib/api-auth";
import { addDays, type BillingPlanId } from "@/lib/billing";
import {
  getPaymentMode,
  getPaydunyaCheckoutCreateUrl,
  hasPaydunyaCredentials,
  validatePaydunyaKeys,
} from "@/lib/paydunya";

/**
 * Simulates mobile money payment via PayDunya / CinetPay.
 * Set PAYMENT_API_KEY and PAYMENT_PROVIDER in .env for production.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthContext();
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { amount, method, phone, store_id, plan } = body as {
      amount: number;
      method: string;
      phone?: string;
      store_id?: string;
      plan?: BillingPlanId;
    };

    if (!amount || amount <= 0 || !Number.isFinite(amount)) {
      return NextResponse.json({ success: false, error: "Montant invalide." }, { status: 400 });
    }
    if (!method || typeof method !== "string") {
      return NextResponse.json({ success: false, error: "Methode de paiement invalide." }, { status: 400 });
    }
    if (!plan || !["starter", "pro", "business"].includes(plan)) {
      return NextResponse.json({ success: false, error: "Plan d'abonnement invalide." }, { status: 400 });
    }

    const { data: ownedStore } = await auth.serviceSupabase
      .from("stores")
      .select("id")
      .eq("owner_id", auth.userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const resolvedStoreId = store_id ?? ownedStore?.id;
    if (!resolvedStoreId) {
      return NextResponse.json(
        { success: false, error: "Aucune boutique associee a ce compte." },
        { status: 404 }
      );
    }
    const access = await checkStoreAccess(auth.serviceSupabase, auth.userId, resolvedStoreId, "write");
    if (!access.ok) {
      return NextResponse.json(
        { success: false, error: access.error ?? "Acces refuse." },
        { status: access.status ?? 403 }
      );
    }

    const provider = process.env.PAYMENT_PROVIDER || "paydunya";
    const apiKey = process.env.PAYMENT_API_KEY;
    const mode = getPaymentMode();
    const transactionId = `WAZO-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    const { error: paymentInsertError } = await auth.serviceSupabase.from("billing_payments").insert({
      store_id: resolvedStoreId,
      user_id: auth.userId,
      plan,
      amount,
      currency: "XOF",
      method,
      provider,
      provider_tx_id: transactionId,
      status: "pending",
      payload: { phone: phone || null, source: "app" },
      updated_at: now,
    });
    if (paymentInsertError) {
      const raw = paymentInsertError.message ?? "";
      const missingTable =
        raw.includes("billing_payments") ||
        raw.includes("schema cache") ||
        raw.includes("does not exist");
      const hint = missingTable
        ? "Table billing manquante: executez supabase/migrations/006_billing_subscriptions.sql dans Supabase SQL Editor."
        : raw;
      return NextResponse.json(
        { success: false, error: `Enregistrement paiement impossible. ${hint}` },
        { status: 500 }
      );
    }

    const activateSubscription = async () => {
      const periodEnd = addDays(new Date().toISOString().slice(0, 10), 30);
      await auth.serviceSupabase.from("billing_subscriptions").upsert(
        {
          store_id: resolvedStoreId,
          plan,
          status: "active",
          trial_start: new Date().toISOString().slice(0, 10),
          trial_days: 14,
          current_period_end: periodEnd,
          last_payment_at: now,
          provider,
          updated_at: now,
        },
        { onConflict: "store_id" }
      );
      await auth.serviceSupabase
        .from("billing_payments")
        .update({ status: "succeeded", updated_at: new Date().toISOString() })
        .eq("provider_tx_id", transactionId);
      return periodEnd;
    };

    // Simulation interne (sans appel PayDunya)
    if (mode === "simulate" || !apiKey) {
      const periodEnd = await activateSubscription();
      return NextResponse.json({
        success: true,
        transaction_id: transactionId,
        provider,
        method,
        plan,
        amount,
        phone: phone || null,
        user_id: auth.userId,
        store_id: resolvedStoreId,
        status: "succeeded",
        period_end: periodEnd,
        payment_environment: mode === "simulate" ? "simulate" : "simulate_no_key",
        message: "Paiement simule avec succes",
      });
    }

    if (provider === "paydunya") {
      const keyError = validatePaydunyaKeys();
      if (keyError) {
        if (mode === "test" && process.env.PAYMENT_ALLOW_SIMULATE_FALLBACK === "true") {
          const periodEnd = await activateSubscription();
          return NextResponse.json({
            success: true,
            transaction_id: transactionId,
            status: "succeeded",
            payment_environment: "simulate_fallback",
            period_end: periodEnd,
            warning: `${keyError} Abonnement active en mode secours.`,
          });
        }
        return NextResponse.json({ success: false, error: keyError }, { status: 400 });
      }
      if (!hasPaydunyaCredentials()) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Cles PayDunya incompletes. Renseignez PAYMENT_API_KEY, PAYMENT_SECRET_KEY et PAYMENT_TOKEN.",
          },
          { status: 400 }
        );
      }

      const checkoutUrl = getPaydunyaCheckoutCreateUrl(mode);
      const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://wazo-digital.vercel.app").replace(
        /\/$/,
        ""
      );
      const callbackSecret = process.env.PAYMENT_CALLBACK_SECRET?.trim() ?? "";
      const callbackQuery = new URLSearchParams({ tx: transactionId });
      if (callbackSecret) {
        callbackQuery.set("secret", callbackSecret);
      }
      const callbackUrl = `${appUrl}/api/payments/momo/callback?${callbackQuery.toString()}`;
      const paydunyaController = new AbortController();
      const paydunyaTimeout = setTimeout(() => paydunyaController.abort(), 12_000);
      let res: Response;
      try {
        res = await fetch(checkoutUrl, {
          method: "POST",
          signal: paydunyaController.signal,
          headers: {
            "Content-Type": "application/json",
            "PAYDUNYA-MASTER-KEY": apiKey,
            "PAYDUNYA-PRIVATE-KEY": process.env.PAYMENT_SECRET_KEY || "",
            "PAYDUNYA-TOKEN": process.env.PAYMENT_TOKEN || "",
          },
          body: JSON.stringify({
            invoice: {
              total_amount: amount,
              description: `Wazo Digital - ${method}`,
            },
            store: { name: "Wazo Digital" },
            actions: {
              callback_url: callbackUrl,
              return_url: `${appUrl}/billing?tx=${transactionId}`,
              cancel_url: `${appUrl}/billing?tx=${transactionId}&status=cancelled`,
            },
          }),
        });
      } catch (paydunyaErr) {
        const paydunyaMsg =
          paydunyaErr instanceof Error && paydunyaErr.name === "AbortError"
            ? "PayDunya ne repond pas (delai depasse)."
            : "Impossible de joindre PayDunya.";
        if (mode === "test" && process.env.PAYMENT_ALLOW_SIMULATE_FALLBACK === "true") {
          const periodEnd = await activateSubscription();
          return NextResponse.json({
            success: true,
            transaction_id: transactionId,
            status: "succeeded",
            payment_environment: "simulate_fallback",
            period_end: periodEnd,
            warning: `${paydunyaMsg} Abonnement active en mode secours (test).`,
          });
        }
        return NextResponse.json({ success: false, error: paydunyaMsg }, { status: 502 });
      } finally {
        clearTimeout(paydunyaTimeout);
      }

      const data = (await res.json()) as Record<string, unknown>;
      await auth.serviceSupabase
        .from("billing_payments")
        .update({ payload: data, updated_at: new Date().toISOString() })
        .eq("provider_tx_id", transactionId);

      const checkoutLink =
        typeof data.response_text === "string" && String(data.response_text).startsWith("http")
          ? data.response_text
          : typeof data.url === "string"
            ? data.url
            : null;

      const paydunyaOk = data.response_code === "00" && Boolean(checkoutLink);

      if (!paydunyaOk) {
        const providerMessage =
          typeof data.response_text === "string" && !String(data.response_text).startsWith("http")
            ? data.response_text
            : typeof data.description === "string"
              ? data.description
              : "PayDunya a refuse la creation de la facture.";

        if (mode === "test" && process.env.PAYMENT_ALLOW_SIMULATE_FALLBACK === "true") {
          const periodEnd = await activateSubscription();
          return NextResponse.json({
            success: true,
            transaction_id: transactionId,
            status: "succeeded",
            payment_environment: "simulate_fallback",
            period_end: periodEnd,
            warning: `PayDunya test indisponible (${providerMessage}). Abonnement active en mode secours.`,
          });
        }

        return NextResponse.json(
          {
            success: false,
            error: providerMessage,
            response_code: data.response_code,
            paydunya_help:
              "Verifiez vos 3 cles TEST PayDunya (Master, Private, Token) dans Integration API.",
          },
          { status: 402 }
        );
      }

      return NextResponse.json({
        success: true,
        transaction_id: transactionId,
        status: "pending",
        payment_environment: mode === "live" ? "paydunya_live" : "paydunya_test",
        checkout_url: checkoutLink,
        token: data.token,
        response_code: data.response_code,
      });
    }

    // CinetPay alternative
    if (provider === "cinetpay") {
      const res = await fetch("https://api-checkout.cinetpay.com/v2/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apikey: apiKey,
          site_id: process.env.CINETPAY_SITE_ID,
          transaction_id: transactionId,
          amount,
          currency: "XOF",
          description: `Wazo - ${method}`,
          notify_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/momo/callback?tx=${transactionId}`,
          return_url: `${process.env.NEXT_PUBLIC_APP_URL}/sales`,
          channels: "ALL",
        }),
      });
      const data = await res.json();
      await auth.serviceSupabase
        .from("billing_payments")
        .update({ payload: data, updated_at: new Date().toISOString() })
        .eq("provider_tx_id", transactionId);
      return NextResponse.json({
        success: data.code === "201",
        transaction_id: transactionId,
        status: "pending",
        ...data,
      });
    }

    return NextResponse.json({ success: false, error: "Fournisseur de paiement inconnu." }, { status: 400 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur lors du paiement.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
