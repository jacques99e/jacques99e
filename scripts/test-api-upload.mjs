/**
 * Test upload produit via API (chemin réel de l'app).
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
const APP = (env.NEXT_PUBLIC_APP_URL || "https://app.wazo-digital.com").replace(/\/$/, "");
const email = process.env.TEST_EMAIL || "test.owner@wazo.africa";
const password = process.env.TEST_PASSWORD || "TestOwner2026!";

const client = createClient(SUPA, ANON, { auth: { persistSession: false } });
const { data: auth, error: authErr } = await client.auth.signInWithPassword({ email, password });
if (authErr) {
  console.error("Auth:", authErr.message);
  process.exit(1);
}

const token = auth.session?.access_token;
const form = new FormData();
form.append("file", new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" }), "test.png");
form.append("bucket", "product-images");

const res = await fetch(`${APP}/api/media/upload`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
  body: form,
});
const body = await res.json();
if (!res.ok || !body.success) {
  console.error("[issue] API upload:", body.error || res.status);
  process.exit(1);
}
console.log("[ok] API /api/media/upload:", body.url?.slice(0, 60) + "...");
