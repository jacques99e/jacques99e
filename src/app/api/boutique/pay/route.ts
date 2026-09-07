import { NextResponse } from "next/server";

export const maxDuration = 60;

import { isCloudUuid } from "@/lib/cloud-uuid";
import {
  getPaymentMode,
  getPaydunyaCheckoutCreateUrl,
  hasPaydunyaCredentials,
  validatePaydunyaKeys,
} from "@/lib/paydunya";
import { allowIp } from "@/lib/rate-limit";
import { isSafeStoreSlug } from "@/lib/utils";
import {
  fulfillPendingSalePayment,
  type SaleCheckoutPayload,
} from "@/lib/sale-payment";
import { notifyStoreSubscribers } from "@/lib/push-server";
import { createServiceSupabase } from "@/lib/supabase/server";

function clip(value: string, max: number): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max);
}

/**
 * Paiement MoMo public : le client paie depuis la boutique, sans session commerçant.
 * POST { slug, productId, quantity?, customerName?, customerPhone? }
 * Le prix vient toujours de la base — jamais du client.
 */
export async function POST(request: Request) {
  if (!allowIp(request, "boutique-pay", 8, 60 * 60 * 1000)) {
    return NextResponse.json(
      { success: false, error: "Trop de paiements. Réessayez plus tard." },
      { status: 429 }
    );
  }

  let body: {
    slug?: string;
    productId?: string;
    quantity?: number;
    customerName?: string;
    customerPhone?: string;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, error: "JSON invalide" }, { status: 400 });
  }

  const slug = (body.slug || "").trim().toLowerCase();
  const productId = (body.productId || "").trim();
  const quantity = Math.min(20, Math.max(1, Math.round(Number(body.quantity) || 1)));
  const customerName = clip(body.customerName || "", 80);
  const customerPhone = clip(body.customerPhone || "", 24);

  if (!isSafeStoreSlug(slug) || !isCloudUuid(productId)) {
    return NextResponse.json(
      { success: false, error: "Boutique ou produit invalide" },
      { status: 400 }
    );
  }

  const db = await createServiceSupabase();
  const { data: store } = await db
    .from("stores")
    .select("id, owner_id, name, slug, is_public")
    .eq("slug", slug)
    .eq("is_public", true)
    .maybeSingle();

  if (!store) {
    return NextResponse.json(
      { success: false, error: "Boutique introuvable ou non publique." },
      { status: 404 }
    );
  }

  const { data: product } = await db
    .from("products")
    .select("id, store_id, name, price, stock")
    .eq("id", productId)
    .eq("store_id", store.id)
    .maybeSingle();

  if (!product) {
    return NextResponse.json(
      { success: false, error: "Produit introuvable." },
      { status: 404 }
    );
  }

  const stock = Math.max(0, Number(product.stock) || 0);
  if (stock < quantity) {
    return NextResponse.json(
      {
        success: false,
        error: stock <= 0 ? "Produit en rupture de stock." : "Stock insuffisant.",
      },
      { status: 409 }
    );
  }

  const unitPrice = Math.round(Math.max(0, Number(product.price) || 0));
  const amountXof = unitPrice * quantity;
  if (amountXof < 200) {
    return NextResponse.json(
      { success: false, error: "Montant minimum Mobile Money : 200 FCFA." },
      { status: 400 }
    );
  }

  const productName = String(product.name || "Produit").slice(0, 120);
  const storeName = String(store.name || "Boutique").slice(0, 80);
  const externalLocalId = `boutique-${crypto.randomUUID()}`;
  const salePayload: SaleCheckoutPayload = {
    external_local_id: externalLocalId,
    items: [
      {
        product_id: product.id,
        name: productName,
        quantity,
        unit_price: unitPrice,
        line_total: amountXof,
      },
    ],
    total: amountXof,
    payment_method: "momo",
  };

  const provider = process.env.PAYMENT_PROVIDER || "paydunya";
  const mode = getPaymentMode();
  const transactionId = `SALE-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();

  const { error: insertError } = await db.from("sale_payments").insert({
    store_id: store.id,
    user_id: store.owner_id,
    amount: amountXof,
    currency: "XOF",
    method: "momo",
    provider,
    provider_tx_id: transactionId,
    status: "pending",
    sale_payload: salePayload,
    payload: {
      source: "boutique",
      slug,
      customer_name: customerName || null,
      customer_phone: customerPhone || null,
    },
    updated_at: now,
  });

  if (insertError) {
    const raw = insertError.message ?? "";
    const missingTable =
      /sale_payments/i.test(raw) &&
      (/schema cache/i.test(raw) || /does not exist/i.test(raw) || /could not find/i.test(raw));
    return NextResponse.json(
      {
        success: false,
        error: missingTable
          ? "Paiement boutique indisponible pour le moment."
          : "Impossible d'enregistrer le paiement.",
      },
      { status: 500 }
    );
  }

  if (mode === "simulate" || !process.env.PAYMENT_API_KEY) {
    const fulfilled = await fulfillPendingSalePayment(db, {
      storeId: store.id,
      salePayload,
      providerTxId: transactionId,
    });
    if ("error" in fulfilled) {
      return NextResponse.json({ success: false, error: fulfilled.error }, { status: 500 });
    }
    await notifyStoreSubscribers(db, store.id, {
      title: "Paiement MoMo reçu",
      body: `${productName} ×${quantity} — ${amountXof} FCFA`,
      url: "/sales",
    });
    return NextResponse.json({
      success: true,
      transaction_id: transactionId,
      status: "succeeded",
      sale_id: fulfilled.saleId,
      amount: amountXof,
      return_url: `/boutique/${slug}/paiement?tx=${encodeURIComponent(transactionId)}`,
    });
  }

  if (provider !== "paydunya") {
    return NextResponse.json(
      { success: false, error: "Paiement Mobile Money indisponible." },
      { status: 400 }
    );
  }

  const keyError = validatePaydunyaKeys();
  if (keyError || !hasPaydunyaCredentials()) {
    return NextResponse.json(
      { success: false, error: "Paiement Mobile Money indisponible pour le moment." },
      { status: 503 }
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
      { success: false, error: "Paiement Mobile Money non configuré." },
      { status: 503 }
    );
  }

  const callbackQuery = new URLSearchParams({ tx: transactionId, kind: "sale" });
  if (callbackSecret) callbackQuery.set("secret", callbackSecret);
  const callbackUrl = `${appUrl}/api/payments/momo/callback?${callbackQuery.toString()}`;
  const returnBase = `${appUrl}/boutique/${slug}/paiement?tx=${encodeURIComponent(transactionId)}`;

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
          description: `${storeName} — ${productName} ×${quantity} — ${amountXof} FCFA`,
        },
        store: { name: storeName.slice(0, 80) },
        custom_data: {
          wazo_tx: transactionId,
          kind: "sale",
          store_id: store.id,
          source: "boutique",
        },
        actions: {
          callback_url: callbackUrl,
          return_url: returnBase,
          cancel_url: `${returnBase}&status=cancelled`,
        },
      }),
    });
  } catch (err) {
    const msg =
      err instanceof Error && err.name === "AbortError"
        ? "Le paiement ne répond pas. Réessayez."
        : "Impossible de lancer le paiement Mobile Money.";
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
      { success: false, error: "Réponse paiement illisible." },
      { status: 502 }
    );
  }

  await db
    .from("sale_payments")
    .update({
      payload: {
        source: "boutique",
        slug,
        customer_name: customerName || null,
        customer_phone: customerPhone || null,
        paydunya: data,
      },
      updated_at: new Date().toISOString(),
    })
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
          "Le paiement Mobile Money a été refusé.",
      },
      { status: 402 }
    );
  }

  return NextResponse.json({
    success: true,
    transaction_id: transactionId,
    status: "pending",
    checkout_url: checkoutLink,
    amount: amountXof,
  });
}
