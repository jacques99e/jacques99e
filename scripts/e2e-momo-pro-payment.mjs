#!/usr/bin/env node
/**
 * Test bout-en-bout PRO via PayDunya MoMo (argent réel si PAYMENT_MODE=live).
 *
 * Usage:
 *   node scripts/e2e-momo-pro-payment.mjs
 *   node scripts/e2e-momo-pro-payment.mjs --store=boutique-test-roles-wazo
 *   node scripts/e2e-momo-pro-payment.mjs --watch-only --tx=WAZO-...
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const SCRIPTS = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(SCRIPTS, "..");
const LANDING = path.join(ROOT, "..", "Landing");

function loadEnv() {
  const out = {};
  for (const p of [path.join(LANDING, ".env.local"), path.join(ROOT, ".env.local")]) {
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i === -1) continue;
      out[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    }
  }
  return out;
}

const args = Object.fromEntries(
  process.argv.slice(2).flatMap((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [[m[1], m[2] ?? "true"]] : [];
  })
);

const env = loadEnv();
const APP = (env.NEXT_PUBLIC_APP_URL || "https://app.wazo-digital.com").replace(/\/$/, "");
const mode = (env.PAYMENT_MODE || "simulate").toLowerCase();
const apiBase =
  mode === "live" ? "https://app.paydunya.com/api/v1" : "https://app.paydunya.com/sandbox-api/v1";
const PRO_AMOUNT = 6550;
const STORE_SLUG = args.store || "boutique-test-roles-wazo";
const POLL_MS = 5000;
const MAX_POLLS = 120; // 10 min

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function confirmPaydunya(token) {
  const res = await fetch(`${apiBase}/checkout-invoice/confirm/${encodeURIComponent(token)}`, {
    headers: {
      "Content-Type": "application/json",
      "PAYDUNYA-MASTER-KEY": env.PAYMENT_API_KEY,
      "PAYDUNYA-PRIVATE-KEY": env.PAYMENT_SECRET_KEY,
      "PAYDUNYA-TOKEN": env.PAYMENT_TOKEN,
    },
  });
  const payload = await res.json().catch(() => ({}));
  const status = String(payload.status ?? payload.invoice?.status ?? "").toLowerCase();
  return { ok: status === "completed" || status === "paid", status, payload };
}

async function watchPayment(txId) {
  console.log(`\n=== Surveillance tx ${txId} (Ctrl+C pour arrêter) ===\n`);
  for (let i = 0; i < MAX_POLLS; i++) {
    const { data: payment } = await admin
      .from("billing_payments")
      .select("id,store_id,plan,status,payload,amount")
      .eq("provider_tx_id", txId)
      .maybeSingle();

    if (!payment) {
      console.log(`[${i + 1}] Paiement introuvable en base`);
      await sleep(POLL_MS);
      continue;
    }

    const payload = payment.payload ?? {};
    const token = typeof payload.token === "string" ? payload.token : "";
    let paydunyaStatus = "";
    if (token) {
      const confirmed = await confirmPaydunya(token);
      paydunyaStatus = confirmed.status || "unknown";
    }

    const { data: sub } = await admin
      .from("billing_subscriptions")
      .select("plan,status,current_period_end")
      .eq("store_id", payment.store_id)
      .maybeSingle();

    console.log(
      `[${i + 1}] DB=${payment.status} · PayDunya=${paydunyaStatus || "—"} · abo=${sub?.plan}/${sub?.status}`
    );

    if (payment.status === "succeeded" && sub?.status === "active" && sub?.plan === "pro") {
      console.log("\n✅ SUCCÈS — PRO actif jusqu'au", sub.current_period_end);
      console.log(`   Historique: ${APP}/billing/history`);
      return true;
    }

    await sleep(POLL_MS);
  }
  console.log("\n⏱ Délai dépassé — paiement non finalisé.");
  return false;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  if (args["watch-only"] === "true" && args.tx) {
    await watchPayment(args.tx);
    return;
  }

  console.log("=== Test MoMo PRO bout-en-bout ===\n");
  console.log(`Mode: ${mode} · Boutique: ${STORE_SLUG} · Montant: ${PRO_AMOUNT} FCFA\n`);

  if (mode !== "live") {
    console.warn("⚠️  PAYMENT_MODE n'est pas 'live' — ce test utilisera le sandbox PayDunya.");
  }

  const { data: store, error: storeErr } = await admin
    .from("stores")
    .select("id,name,slug,owner_id")
    .eq("slug", STORE_SLUG)
    .maybeSingle();
  if (storeErr || !store) {
    console.error("Boutique introuvable:", STORE_SLUG);
    process.exit(1);
  }

  const { data: sub } = await admin
    .from("billing_subscriptions")
    .select("plan,status,current_period_end")
    .eq("store_id", store.id)
    .maybeSingle();
  console.log("État actuel:", sub ? `${sub.plan}/${sub.status}` : "aucun abonnement");

  if (!env.PAYMENT_API_KEY || !env.PAYMENT_SECRET_KEY || !env.PAYMENT_TOKEN) {
    console.error("Clés PayDunya manquantes dans .env.local");
    process.exit(1);
  }

  const transactionId = `WAZO-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  const callbackSecret = env.PAYMENT_CALLBACK_SECRET?.trim() ?? "";
  const callbackQuery = new URLSearchParams({ tx: transactionId });
  if (callbackSecret) callbackQuery.set("secret", callbackSecret);
  const callbackUrl = `${APP}/api/payments/momo/callback?${callbackQuery.toString()}`;

  const { error: insertErr } = await admin.from("billing_payments").insert({
    store_id: store.id,
    user_id: store.owner_id,
    plan: "pro",
    amount: PRO_AMOUNT,
    currency: "XOF",
    method: "momo",
    provider: "paydunya",
    provider_tx_id: transactionId,
    status: "pending",
    payload: { phone: null, source: "e2e-momo-pro-payment" },
    updated_at: now,
  });
  if (insertErr) {
    console.error("Insert billing_payments:", insertErr.message);
    process.exit(1);
  }

  const res = await fetch(`${apiBase}/checkout-invoice/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "PAYDUNYA-MASTER-KEY": env.PAYMENT_API_KEY,
      "PAYDUNYA-PRIVATE-KEY": env.PAYMENT_SECRET_KEY,
      "PAYDUNYA-TOKEN": env.PAYMENT_TOKEN,
    },
    body: JSON.stringify({
      invoice: {
        total_amount: PRO_AMOUNT,
        description: "Wazo Digital PRO — test E2E MoMo",
      },
      store: { name: "Wazo Digital" },
      actions: {
        callback_url: callbackUrl,
        return_url: `${APP}/billing?tx=${transactionId}`,
        cancel_url: `${APP}/billing?tx=${transactionId}&status=cancelled`,
      },
    }),
  });

  const data = await res.json().catch(() => ({}));
  const checkoutLink =
    typeof data.response_text === "string" && data.response_text.startsWith("http")
      ? data.response_text
      : typeof data.url === "string"
        ? data.url
        : null;

  if (data.response_code !== "00" || !checkoutLink) {
    console.error("PayDunya refuse:", data.response_text || JSON.stringify(data));
    process.exit(1);
  }

  await admin
    .from("billing_payments")
    .update({ payload: data, updated_at: new Date().toISOString() })
    .eq("provider_tx_id", transactionId);

  console.log("Facture créée:", transactionId);
  console.log("Token PayDunya:", data.token);
  console.log("\n--- PAYEZ MAINTENANT (6 550 FCFA) ---");
  console.log(checkoutLink);
  console.log("-------------------------------------\n");
  console.log("Compte app (optionnel): test.owner@wazo.africa / TestOwner2026!");
  console.log(`Retour app: ${APP}/billing?tx=${transactionId}`);
  console.log(`Callback IPN: ${callbackUrl.replace(callbackSecret, "***")}\n`);

  await watchPayment(transactionId);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
