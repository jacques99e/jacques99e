#!/usr/bin/env node
/** Test sale insert as service role + simulate owner RLS */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = path.join(ROOT, "..", ".env.local");
  const out = {};
  if (!fs.existsSync(envPath)) return out;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const v = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    if (v) out[t.slice(0, i).trim()] = v;
  }
  return out;
}

const env = loadEnv();
const { createClient } = await import("@supabase/supabase-js");

const storeId = "2ff51421-26bd-4ac0-9fe6-54dda3de2fc2";
const localId = `test-sale-${Date.now()}`;

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

console.log("=== Insert (select+insert pattern) ===");
const { data: sale, error } = await admin
  .from("sales")
  .insert({
    store_id: storeId,
    total_amount: 1000,
    total: 1000,
    payment_method: "cash",
    payment_status: "completed",
    external_local_id: localId,
  })
  .select("id")
  .single();

console.log({ sale, error: error?.message, code: error?.code });

if (sale?.id) {
  const { error: itemsErr } = await admin.from("sale_items").insert({
    sale_id: sale.id,
    product_id: null,
    product_name: "Test produit",
    quantity: 1,
    unit_price: 1000,
    subtotal: 1000,
  });
  console.log("sale_items:", itemsErr?.message || "ok");

  // cleanup test
  await admin.from("sales").delete().eq("id", sale.id);
  console.log("(test row deleted)");
}

// Owner RLS test
const email = process.env.E2E_OWNER_EMAIL || "test.owner@wazo.africa";
const password = process.env.E2E_OWNER_PASSWORD || "TestOwner2026!";

const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const { data: auth, error: authErr } = await anon.auth.signInWithPassword({ email, password });
console.log("\n=== Owner session test (test account) ===");
console.log("auth:", authErr?.message || auth.user?.email);

if (auth.session) {
  const userClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${auth.session.access_token}` } },
  });
  const { data: ownerStore } = await userClient
    .from("stores")
    .select("id")
    .eq("slug", "boutique-test-roles-wazo")
    .single();

  if (ownerStore?.id) {
    const lid = `test-owner-${Date.now()}`;
    const { data: s2, error: e2 } = await userClient
      .from("sales")
      .insert({
        store_id: ownerStore.id,
        total_amount: 500,
        total: 500,
        payment_method: "cash",
        payment_status: "completed",
        external_local_id: lid,
      })
      .select("id")
      .single();
    console.log("owner insert:", e2?.message || s2?.id);
    if (s2?.id) await userClient.from("sales").delete().eq("id", s2.id);
  }
}

// Try to find Balade owner email
const { data: balade } = await admin
  .from("stores")
  .select("owner_id, profiles:owner_id(full_name)")
  .eq("slug", "balade-estivale")
  .single();
console.log("\nBalade owner:", balade);
