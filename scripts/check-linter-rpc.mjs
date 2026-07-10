/**
 * Vérifie si les fonctions SECURITY DEFINER sont encore exposées en RPC (anon).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

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
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (value) out[trimmed.slice(0, idx).trim()] = value;
  }
  return out;
}

const env = loadEnvFile(path.join(ROOT, ".env.local"));
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anon) {
  console.error("NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY requis.");
  process.exit(1);
}

const storeId = "00000000-0000-0000-0000-000000000000";

async function testRpc(name, body = { target_store_id: storeId }) {
  const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: anon,
      Authorization: `Bearer ${anon}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, text: text.slice(0, 160) };
}

const checks = [
  ["can_access_store", { target_store_id: storeId }],
  ["can_manage_store", { target_store_id: storeId }],
  ["can_write_store_data", { target_store_id: storeId }],
  ["user_store_ids", {}],
  ["handle_new_user", {}],
];

let exposed = 0;
for (const [name, body] of checks) {
  const { status, text } = await testRpc(name, body);
  const blocked =
    status === 401 ||
    status === 403 ||
    status === 404 ||
    text.includes("permission denied");
  console.log(`${name}: HTTP ${status} ${blocked ? "bloqué" : "ENCORE EXPOSÉ"} — ${text}`);
  if (!blocked && status < 500) exposed += 1;
}

process.exit(exposed > 0 ? 1 : 0);
