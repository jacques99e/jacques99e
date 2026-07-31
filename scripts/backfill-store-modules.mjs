#!/usr/bin/env node
/** Applique la migration 023 store_modules via SQL REST (rpc) ou lit le fichier pour rappel. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const sqlPath = path.join(ROOT, "supabase", "migrations", "023_store_modules_persist.sql");

function loadEnv() {
  const out = {};
  const file = path.join(ROOT, ".env.local");
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing Supabase env");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });

// Backfill logique équivalente (sans DROP POLICY via JS — faire la policy via SQL Editor si besoin)
const { data: stores } = await admin.from("stores").select("id, owner_id, modules, slug, name");
const { data: profiles } = await admin.from("profiles").select("id, active_modules");
const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

let fixed = 0;
for (const s of stores || []) {
  const { data: existing } = await admin
    .from("store_modules")
    .select("module_id")
    .eq("store_id", s.id)
    .eq("enabled", true);

  const fromStore = (existing || []).map((r) => r.module_id);
  const raw = profileMap.get(s.owner_id)?.active_modules;
  const fromProfile = Array.isArray(raw) ? raw.map(String) : [];
  const union = [...new Set([...fromStore, ...fromProfile].filter(Boolean))];
  const modules = union.length ? union : ["commerce"];

  const need =
    !fromStore.length ||
    modules.some((m) => !fromStore.includes(m)) ||
    JSON.stringify([...(s.modules || [])].sort()) !== JSON.stringify([...modules].sort());

  if (!need) continue;

  await admin.from("store_modules").delete().eq("store_id", s.id);
  await admin.from("store_modules").insert(
    modules.map((module_id) => ({ store_id: s.id, module_id, enabled: true }))
  );
  await admin.from("stores").update({ modules }).eq("id", s.id);
  if (s.owner_id) {
    await admin.from("profiles").update({ active_modules: modules }).eq("id", s.owner_id);
  }
  fixed += 1;
  console.log(`fixed ${s.slug || s.name}: ${modules.join(", ")}`);
}

console.log(`Done. Stores fixed: ${fixed}/${(stores || []).length}`);
console.log(`SQL file (RLS policy): ${sqlPath}`);
