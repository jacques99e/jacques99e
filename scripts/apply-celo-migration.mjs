/**
 * Applique la migration 007 via l'API SQL Supabase (pg_meta) ou affiche les instructions.
 * Utilise SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL depuis .env.local
 */
import fs from "fs";
import path from "path";

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  const out = {};
  if (!fs.existsSync(envPath)) return out;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    out[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = loadEnv();
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("[migration] Variables Supabase manquantes dans .env.local");
  process.exit(1);
}

const checkRes = await fetch(`${supabaseUrl}/rest/v1/blockchain_assets?select=celo_tx_hash&limit=1`, {
  headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
});
const checkBody = await checkRes.text();

if (checkRes.ok) {
  console.log("[migration] Colonnes Celo deja presentes — rien a faire.");
  process.exit(0);
}

if (!checkBody.includes("celo_tx_hash does not exist")) {
  console.error("[migration] Erreur inattendue:", checkBody);
  process.exit(1);
}

const sql = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/013_celo_blockchain.sql"),
  "utf8"
);

// Supabase n'expose pas DDL via REST — tentative via endpoint SQL du dashboard (project ref)
const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
const sqlUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;

const token = env.SUPABASE_ACCESS_TOKEN?.trim();
if (token) {
  const res = await fetch(sqlUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.text();
  if (res.ok) {
    console.log("[migration] Migration 007 appliquee via API Supabase.");
    process.exit(0);
  }
  console.warn("[migration] API Supabase:", body);
}

console.log(`
[migration] ACTION MANUELLE REQUISE (1 minute)
1. Ouvrir https://supabase.com/dashboard/project/${projectRef}/sql/new
2. Coller le contenu de supabase/migrations/013_celo_blockchain.sql
3. Cliquer Run
`);
console.log("--- SQL ---");
console.log(sql.trim());
console.log("-----------");
