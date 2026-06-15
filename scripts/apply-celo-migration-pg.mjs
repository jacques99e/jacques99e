/**
 * Applique la migration 013 si SUPABASE_DB_URL est defini dans .env.local
 * (Supabase > Settings > Database > Connection string > URI)
 */
import fs from "fs";
import path from "path";
import postgres from "postgres";

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
const dbUrl = env.SUPABASE_DB_URL?.trim();
if (!dbUrl) {
  console.log("[migration-pg] SUPABASE_DB_URL absent — utilisez le SQL Editor Supabase.");
  process.exit(0);
}

const sql = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/013_celo_blockchain.sql"),
  "utf8"
);

const db = postgres(dbUrl, { max: 1 });
try {
  await db.unsafe(sql);
  console.log("[migration-pg] Migration 013 Celo appliquee.");
} finally {
  await db.end({ timeout: 5 });
}
