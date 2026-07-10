/**
 * Applique les correctifs linter Supabase (migration 009).
 * Nécessite SUPABASE_DB_URL dans .env.local.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROJECT_REF = "gfqmmdihubcpvouidpkc";
const SQL_EDITOR = `https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new`;

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
const dbUrl = env.SUPABASE_DB_URL?.trim();
const sqlPath = path.join(ROOT, "supabase/migrations/009_security_linter_fixes.sql");
const sql = fs.readFileSync(sqlPath, "utf8");

if (!dbUrl) {
  console.log("SUPABASE_DB_URL absent.\n");
  console.log("1. Ouvrez:", SQL_EDITOR);
  console.log("2. Collez le contenu de supabase/migrations/009_security_linter_fixes.sql");
  console.log("3. Cliquez Run\n");
  console.log("Pour automatiser: ajoutez SUPABASE_DB_URL dans .env.local puis relancez.");
  process.exit(1);
}

const postgres = (await import("postgres")).default;
const db = postgres(dbUrl, { max: 1, ssl: "require" });

try {
  await db.unsafe(sql);
  console.log("[ok] Migration 009 appliquée.");
} catch (e) {
  console.error("[fail]", e.message);
  process.exit(1);
} finally {
  await db.end({ timeout: 5 });
}
