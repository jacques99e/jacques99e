#!/usr/bin/env node
/**
 * Applique une migration SQL Supabase si DATABASE_URL est défini.
 * Sinon affiche le SQL à coller dans Supabase SQL Editor.
 *
 * Usage:
 *   node scripts/apply-migration-010.mjs           # migration 010 (défaut)
 *   node scripts/apply-migration-010.mjs 012       # migration 012 RLS grants
 *   DATABASE_URL="postgresql://..." node scripts/apply-migration-010.mjs 012
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mig = process.argv[2] || "010";
const sqlPath = path.join(__dirname, `../supabase/migrations/${mig}_*.sql`);
const files = fs.readdirSync(path.join(__dirname, "../supabase/migrations")).filter((f) => f.startsWith(`${mig}_`));
if (!files.length) {
  console.error(`Migration ${mig} introuvable`);
  process.exit(1);
}
const sql = fs.readFileSync(path.join(__dirname, "../supabase/migrations", files[0]), "utf8").trim();
const dbUrl = process.env.DATABASE_URL;
const sqlEditor = "https://supabase.com/dashboard/project/gfqmmdihubcpvouidpkc/sql/new";

if (!dbUrl) {
  console.log(`
Migration ${mig} — ${files[0]}

Collez ce SQL dans Supabase SQL Editor :
${sqlEditor}

---
${sql}
---

Ou définissez DATABASE_URL (Settings → Database → Connection string → URI)
puis relancez : node scripts/apply-migration-010.mjs ${mig}
`);
  process.exit(0);
}

const { Client } = await import("pg");
const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  await client.query(sql);
  console.log(`OK — migration ${mig} (${files[0]}) appliquée.`);
  process.exit(0);
} catch (e) {
  console.error("Erreur migration:", e.message);
  process.exit(1);
} finally {
  await client.end().catch(() => undefined);
}
