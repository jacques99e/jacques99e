#!/usr/bin/env node
/**
 * Réconcilie les paiements PRO pending via PayDunya confirm API.
 * Usage: node scripts/reconcile-pending-pro-payments.mjs [--dry-run]
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const dryRun = process.argv.includes("--dry-run");

function loadEnv() {
  const out = {};
  for (const line of fs.readFileSync(path.join(ROOT, "..", ".env.local"), "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = loadEnv();
const mode = (env.PAYMENT_MODE || "simulate").toLowerCase();
const apiBase =
  mode === "live"
    ? "https://app.paydunya.com/api/v1"
    : "https://app.paydunya.com/sandbox-api/v1";

async function confirmToken(token) {
  const res = await fetch(`${apiBase}/checkout-invoice/confirm/${encodeURIComponent(token)}`, {
    headers: {
      "Content-Type": "application/json",
      "PAYDUNYA-MASTER-KEY": env.PAYMENT_API_KEY,
      "PAYDUNYA-PRIVATE-KEY": env.PAYMENT_SECRET_KEY,
      "PAYDUNYA-TOKEN": env.PAYMENT_TOKEN,
    },
  });
  const payload = await res.json().catch(() => ({}));
  const status = String(payload.status ?? "").toLowerCase();
  return { status, completed: status === "completed", payload };
}

function addDays(isoDate, days) {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: pending } = await admin
  .from("billing_payments")
  .select("id,store_id,plan,status,provider_tx_id,payload,created_at")
  .eq("status", "pending")
  .in("plan", ["pro", "business"])
  .order("created_at", { ascending: false });

console.log(`=== Réconciliation pending (${pending?.length ?? 0}) mode=${mode} ===\n`);
let activated = 0;

for (const p of pending || []) {
  const payload = p.payload && typeof p.payload === "object" ? p.payload : {};
  const token = typeof payload.token === "string" ? payload.token : "";
  const { data: st } = await admin.from("stores").select("name,slug").eq("id", p.store_id).maybeSingle();
  const label = `${st?.name || p.store_id} (${st?.slug || "?"})`;

  if (!token) {
    console.log(`- skip ${label} · ${p.provider_tx_id} · pas de token PayDunya`);
    continue;
  }

  const { status, completed } = await confirmToken(token);
  console.log(`- ${label} · ${p.plan} · PayDunya=${status} · tx ${p.provider_tx_id}`);

  if (!completed) continue;

  const now = new Date().toISOString();
  const periodEnd = addDays(now.slice(0, 10), 30);

  if (dryRun) {
    console.log(`  → would activate ${p.plan} until ${periodEnd}`);
    activated++;
    continue;
  }

  await admin.from("billing_payments").update({ status: "succeeded", updated_at: now }).eq("id", p.id);
  await admin.from("billing_subscriptions").upsert(
    {
      store_id: p.store_id,
      plan: p.plan,
      status: "active",
      current_period_end: periodEnd,
      last_payment_at: now,
      provider: "paydunya",
      updated_at: now,
    },
    { onConflict: "store_id" }
  );
  console.log(`  → ACTIVÉ ${p.plan} until ${periodEnd}`);
  activated++;
}

console.log(`\n${dryRun ? "Would activate" : "Activated"}: ${activated}`);
if (activated && !dryRun) {
  console.log("Run: node ../Landing/scripts/check-billing-pro.mjs");
}
