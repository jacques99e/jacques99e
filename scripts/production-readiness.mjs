#!/usr/bin/env node
/**
 * Vérification production complète (local + prod).
 * Usage: node scripts/production-readiness.mjs
 */
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const SCRIPTS = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(SCRIPTS, "..");
const LANDING = path.join(ROOT, "..", "Landing");
const APP = process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://app.wazo-digital.com";
const SITE = process.env.NEXT_PUBLIC_LANDING_URL?.trim() || "https://wazo-digital.com";

function loadEnv() {
  const out = {};
  for (const p of [path.join(ROOT, ".env.local"), path.join(LANDING, ".env.local"), path.join(ROOT, ".env.vercel.production")]) {
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i === -1) continue;
      const v = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
      if (v) out[t.slice(0, i).trim()] = v;
    }
  }
  return out;
}

function run(label, cmd, args, cwd = ROOT) {
  console.log(`\n▶ ${label}`);
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit", shell: true });
  return r.status === 0;
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

async function testSalesApi(env) {
  console.log("\n▶ API ventes (owner test)");
  const email = process.env.E2E_OWNER_EMAIL || "test.owner@wazo.africa";
  const password = process.env.E2E_OWNER_PASSWORD || "TestOwner2026!";
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    console.log("[skip] clés Supabase manquantes");
    return false;
  }

  const { createClient } = await import("@supabase/supabase-js");
  let accessToken = "";

  const authRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const auth = await authRes.json().catch(() => ({}));
  if (authRes.ok && auth.access_token) {
    accessToken = auth.access_token;
  } else {
    const msg = String(auth.error_description || auth.msg || auth.error || authRes.status);
    if (!/captcha/i.test(msg) || !env.SUPABASE_SERVICE_ROLE_KEY) {
      console.log(`[!!] auth: ${msg}`);
      return false;
    }
    // CAPTCHA Auth actif → session via magic link admin (scripts uniquement)
    const adminAuth = createClient(supabaseUrl, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: linkData, error: linkError } = await adminAuth.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (linkError || !linkData?.properties?.hashed_token) {
      console.log(`[!!] auth magiclink: ${linkError?.message || "no token"}`);
      return false;
    }
    const anon = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: otp, error: otpError } = await anon.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: "email",
    });
    if (otpError || !otp?.session?.access_token) {
      console.log(`[!!] auth verifyOtp: ${otpError?.message || "no session"}`);
      return false;
    }
    accessToken = otp.session.access_token;
    console.log("[ok] auth via magiclink admin (CAPTCHA contourné pour script)");
  }

  const admin = createClient(supabaseUrl, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const { data: store } = await admin
    .from("stores")
    .select("id")
    .eq("slug", "boutique-test-roles-wazo")
    .single();
  if (!store?.id) {
    console.log("[!!] boutique test introuvable");
    return false;
  }

  const extId = `prod-ready-${Date.now()}`;
  const res = await fetch(`${APP}/api/sales`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      store_id: store.id,
      external_local_id: extId,
      total_amount: 100,
      payment_method: "cash",
      items: [{ product_name: "Test prod ready", quantity: 1, unit_price: 100, subtotal: 100 }],
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.success) {
    console.log(`[!!] POST /api/sales → ${res.status}`, body.error || body);
    return false;
  }
  console.log(`[ok] POST /api/sales → ${body.id}`);
  await admin.from("sales").delete().eq("id", body.id);
  console.log("[ok] test vente supprimée");
  return true;
}

console.log(`=== Wazo Digital — production readiness ${new Date().toISOString().slice(0, 10)} ===`);

const env = loadEnv();
const checks = [];

const landingHealth = await fetchJson(`${SITE}/api/health`);
checks.push(landingHealth.ok && landingHealth.body.ok === true);
console.log(landingHealth.ok ? `[ok] landing health v${landingHealth.body.version}` : `[!!] landing health`);

const appHealth = await fetchJson(`${APP}/api/health`);
checks.push(appHealth.ok && appHealth.body.ok === true);
console.log(appHealth.ok ? `[ok] app health v${appHealth.body.version}` : `[!!] app health`);
if (appHealth.body.serviceRole === false) console.log("[!!] SUPABASE_SERVICE_ROLE_KEY manquant Vercel");
if (appHealth.body.crons === false || appHealth.body.crons?.configured === false) {
  console.log("[!!] CRON_SECRET manquant Vercel");
}

const gscRes = await fetch(SITE, { cache: "no-store" });
const gscHtml = await gscRes.text();
const gscOk = gscHtml.includes("google-site-verification");
console.log(gscOk ? "[ok] balise Google Search Console" : "[ ] balise GSC absente");

checks.push(await testSalesApi(env));

checks.push(run("Audit Supabase", "node", ["scripts/audit-supabase.mjs"]));
checks.push(run("Audit Vercel env", "node", ["scripts/audit-vercel.mjs"]));
checks.push(run("Stats lancement", "node", ["scripts/launch-stats.mjs"]));

if (fs.existsSync(LANDING)) {
  checks.push(run("Monitor production", "node", ["scripts/monitor-production.mjs"], LANDING));
  checks.push(run("Launch verify", "node", ["scripts/launch-verify.mjs"], LANDING));
}

console.log("\n=== Résumé ===");
const failed = checks.filter((c) => !c).length;
if (failed === 0) {
  console.log("Prêt pour la production (vérifications automatiques OK).");
  console.log("\nActions manuelles restantes :");
  console.log("  1. Migration 015 : ajoutez SUPABASE_DB_URL puis npm run audit:supabase (auto-fix RLS)");
  console.log("  2. GSC : Vérifier propriété + soumettre sitemap");
  console.log("  3. Recruter pilotes 2–5 : npm run pilot:prospects (Landing)");
} else {
  console.log(`${failed} vérification(s) en échec — corriger avant go-live public.`);
  process.exit(1);
}
