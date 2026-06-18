/**
 * Applique un fichier SQL de supabase/migrations/ si SUPABASE_DB_URL est défini.
 * Usage: node scripts/apply-supabase-sql.mjs 014_ensure_storage_buckets.sql
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

const env = {
  ...loadEnvFile(path.join(ROOT, ".env.local")),
  ...Object.fromEntries(
    ["SUPABASE_DB_URL"].map((k) => [k, process.env[k]]).filter(([, v]) => v)
  ),
};

const fileArg = process.argv[2];
if (!fileArg) {
  console.error("Usage: node scripts/apply-supabase-sql.mjs <migration-file.sql>");
  process.exit(1);
}

const dbUrl = env.SUPABASE_DB_URL?.trim();
if (!dbUrl) {
  console.error("SUPABASE_DB_URL absent dans .env.local");
  console.error("Supabase > Project Settings > Database > Connection string (URI)");
  process.exit(1);
}

const sqlPath = path.join(ROOT, "supabase/migrations", fileArg);
if (!fs.existsSync(sqlPath)) {
  console.error("Fichier introuvable:", sqlPath);
  process.exit(1);
}

const sql = fs.readFileSync(sqlPath, "utf8");
const version = path.basename(fileArg, ".sql").split("_")[0];

const postgres = (await import("postgres")).default;
const db = postgres(dbUrl, { max: 1 });

try {
  await db.unsafe(sql);
  await db`
    INSERT INTO supabase_migrations.schema_migrations (version)
    VALUES (${version})
    ON CONFLICT DO NOTHING
  `;
  console.log(`[ok] ${fileArg} appliquée (version ${version})`);
} catch (e) {
  console.error("[fail]", e.message);
  process.exit(1);
} finally {
  await db.end({ timeout: 5 });
}
