import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = {};
for (const line of fs.readFileSync(path.join(root, ".env.local"), "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i < 0) continue;
  env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
}

const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE url/service role");
  process.exit(1);
}

const sql = fs.readFileSync(path.join(root, "supabase/migrations/020_sale_payments.sql"), "utf8");
const supabase = createClient(url, key, { auth: { persistSession: false } });

// Prefer rpc exec if available; else try splitting statements via postgrest won't work for DDL.
// Use Supabase SQL via management is not available with service role alone.
// Fallback: create table through a sequence of REST-compatible checks — use fetch to postgres if DATABASE_URL set.

const dbUrl = env.SUPABASE_DB_URL || env.DATABASE_URL;
if (dbUrl) {
  const { default: pg } = await import("pg").catch(() => ({ default: null }));
  if (!pg) {
    console.error("Install pg or apply SQL manually in Supabase SQL Editor:");
    console.log(sql);
    process.exit(1);
  }
  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  await client.query(sql);
  await client.end();
  console.log("Migration 020 applied via DATABASE_URL");
  process.exit(0);
}

// Try supabase rpc exec_sql
const { error } = await supabase.rpc("exec_sql", { query: sql });
if (error) {
  console.error("Cannot auto-apply migration:", error.message);
  console.log("\n--- Apply manually in Supabase SQL Editor ---\n");
  console.log(sql);
  process.exit(2);
}
console.log("Migration applied via exec_sql");
