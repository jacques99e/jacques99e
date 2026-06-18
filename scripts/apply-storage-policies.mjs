/**
 * Applique la migration storage 014 via Management API (SUPABASE_ACCESS_TOKEN) ou affiche le SQL.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function mergeEnv(...sources) {
  const out = {};
  for (const source of sources) {
    for (const [key, value] of Object.entries(source)) {
      if (value) out[key] = value;
    }
  }
  return out;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    let value = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (value) out[trimmed.slice(0, idx).trim()] = value;
  }
  return out;
}

const env = mergeEnv(
  loadEnvFile(path.join(ROOT, ".env.local")),
  Object.fromEntries(
    [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "SUPABASE_ACCESS_TOKEN",
      "SUPABASE_DB_URL",
    ]
      .map((k) => [k, process.env[k]])
      .filter(([, v]) => v)
  )
);

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const projectRef = supabaseUrl ? new URL(supabaseUrl).hostname.split(".")[0] : "";
const sqlPath = path.join(ROOT, "supabase/migrations/014_ensure_storage_buckets.sql");
const sql = fs.readFileSync(sqlPath, "utf8");

async function policiesOk() {
  const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anon || !service) return false;

  const admin = createClient(supabaseUrl, service, { auth: { persistSession: false } });
  const client = createClient(supabaseUrl, anon, { auth: { persistSession: false } });
  const email = process.env.TEST_EMAIL || "test.owner@wazo.africa";
  const password = process.env.TEST_PASSWORD || "TestOwner2026!";

  const { data: auth } = await client.auth.signInWithPassword({ email, password });
  if (!auth.session) return false;

  const pathKey = `${auth.user.id}/${Date.now()}.txt`;
  const { error } = await client.storage.from("product-images").upload(pathKey, Buffer.from("x"), {
    contentType: "text/plain",
    upsert: false,
  });
  if (!error) {
    await admin.storage.from("product-images").remove([pathKey]);
    return true;
  }
  return false;
}

if (await policiesOk()) {
  console.log("[ok] Politiques storage product-images déjà actives.");
  process.exit(0);
}

const dbUrl = env.SUPABASE_DB_URL?.trim();
if (dbUrl) {
  const postgres = (await import("postgres")).default;
  const db = postgres(dbUrl, { max: 1 });
  try {
    await db.unsafe(sql);
    console.log("[fixed] Migration 014 appliquée via SUPABASE_DB_URL.");
    process.exit(0);
  } catch (e) {
    console.error("[fail] SUPABASE_DB_URL:", e.message);
  } finally {
    await db.end({ timeout: 5 });
  }
}

const token = env.SUPABASE_ACCESS_TOKEN?.trim();
if (token && projectRef) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.text();
  if (res.ok) {
    console.log("[fixed] Migration 014 appliquée via Management API.");
    process.exit(0);
  }
  console.warn("[warn] Management API:", body.slice(0, 200));
}

console.log(`
[action] Politiques storage manquantes — exécutez la migration 014 :

1. Ouvrir https://supabase.com/dashboard/project/${projectRef}/sql/new
2. Coller le fichier supabase/migrations/014_ensure_storage_buckets.sql
3. Cliquer Run

Ou ajoutez SUPABASE_ACCESS_TOKEN (dashboard > Account > Access Tokens)
ou SUPABASE_DB_URL (Settings > Database > Connection string URI) puis relancez :
  npm run apply:storage-policies
`);
