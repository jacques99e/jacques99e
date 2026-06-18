/**
 * Test upload storage en tant qu'utilisateur authentifié (vérifie politiques RLS storage).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    let value = trimmed.slice(idx + 1).trim();
    if (value) out[trimmed.slice(0, idx).trim()] = value.replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = loadEnvFile(path.join(ROOT, ".env.local"));
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const email = process.env.TEST_EMAIL || "test.owner@wazo.africa";
const password = process.env.TEST_PASSWORD || "TestOwner2026!";

if (!SUPA || !ANON) {
  console.error("Clés Supabase manquantes");
  process.exit(1);
}

const client = createClient(SUPA, ANON, { auth: { persistSession: false } });

const { data: auth, error: authErr } = await client.auth.signInWithPassword({ email, password });
if (authErr) {
  console.error("Auth:", authErr.message);
  process.exit(1);
}

const userId = auth.user.id;
const pathKey = `${userId}/${Date.now()}.txt`;
const buffer = Buffer.from("policy-test");

const { error: upErr } = await client.storage.from("product-images").upload(pathKey, buffer, {
  contentType: "text/plain",
  upsert: false,
});

if (upErr) {
  console.error("[issue] upload auth direct:", upErr.message);
  process.exit(1);
}

await client.storage.from("product-images").remove([pathKey]);
console.log("[ok] upload auth direct product-images (politiques OK)");
