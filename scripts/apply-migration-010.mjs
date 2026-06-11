#!/usr/bin/env node
/**
 * Applique la migration 010 (allow_momo_links) si DATABASE_URL est défini.
 * Sinon affiche le SQL à coller dans Supabase SQL Editor.
 *
 * Usage:
 *   DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-....pooler.supabase.com:6543/postgres" node scripts/apply-migration-010.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.join(__dirname, "../supabase/migrations/010_momo_member_permissions.sql");
const sql = fs.readFileSync(sqlPath, "utf8").trim();
const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.log(`
Migration 010 — allow_momo_links sur store_members

Collez ce SQL dans Supabase SQL Editor :
https://supabase.com/dashboard/project/gfqmmdihubcpvouidpkc/sql/new

---
${sql}
---

Ou définissez DATABASE_URL (Settings → Database → Connection string → URI)
puis relancez : node scripts/apply-migration-010.mjs
`);
  process.exit(0);
}

const { Client } = await import("pg");
const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  await client.query(sql);
  const check = await client.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'store_members' AND column_name = 'allow_momo_links'"
  );
  console.log(check.rowCount ? "OK — colonne allow_momo_links présente." : "FAIL — colonne absente après migration.");
  process.exit(check.rowCount ? 0 : 1);
} catch (e) {
  console.error("Erreur migration:", e.message);
  process.exit(1);
} finally {
  await client.end().catch(() => undefined);
}
