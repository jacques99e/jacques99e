/**
 * Audit Supabase: buckets, tables, RLS smoke tests, storage policies (via SQL if SUPABASE_DB_URL).
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

function mergeEnv(...sources) {
  const out = {};
  for (const source of sources) {
    for (const [key, value] of Object.entries(source)) {
      if (value) out[key] = value;
    }
  }
  return out;
}

const env = mergeEnv(
  loadEnvFile(path.join(ROOT, ".env.local")),
  loadEnvFile(path.join(ROOT, ".env.vercel.production")),
  Object.fromEntries(
    ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_DB_URL"]
      .map((k) => [k, process.env[k]])
      .filter(([, v]) => v)
  )
);

const SUPA = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const DB_URL = env.SUPABASE_DB_URL;

if (!SUPA || !SERVICE) {
  console.error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis.");
  process.exit(1);
}

const REQUIRED_BUCKETS = ["product-images", "course-media", "certificates", "health-docs"];

const CRITICAL_TABLES = [
  "profiles",
  "stores",
  "store_members",
  "products",
  "sales",
  "sale_items",
  "crm_clients",
  "health_appointments",
  "courses",
  "course_modules",
  "course_enrollments",
  "billing_subscriptions",
  "billing_payments",
  "audit_logs",
  "deliveries",
  "push_subscriptions",
  "blockchain_assets",
  "store_modules",
];

const admin = createClient(SUPA, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const anon = ANON
  ? createClient(SUPA, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

const issues = [];
const fixes = [];

async function checkBuckets() {
  const { data, error } = await admin.storage.listBuckets();
  if (error) {
    issues.push(`[storage] listBuckets: ${error.message}`);
    return;
  }
  const ids = new Set((data || []).map((b) => b.id));
  for (const id of REQUIRED_BUCKETS) {
    if (!ids.has(id)) issues.push(`[storage] Bucket manquant: ${id}`);
    else console.log(`[ok] bucket ${id}`);
  }
}

async function checkTables() {
  for (const table of CRITICAL_TABLES) {
    const { error, count } = await admin.from(table).select("*", { count: "exact", head: true });
    if (error) {
      issues.push(`[table] ${table}: ${error.message} (${error.code || "?"})`);
    } else {
      console.log(`[ok] table ${table} (${count ?? 0} rows)`);
    }
  }
}

const SENSITIVE_ANON_TABLES = [
  "profiles",
  "audit_logs",
  "billing_subscriptions",
  "billing_payments",
  "store_members",
  "sales",
  "crm_clients",
];

async function checkAnonRls() {
  if (!anon) {
    console.log("[skip] anon key absent — test RLS anon ignoré");
    return;
  }

  for (const table of SENSITIVE_ANON_TABLES) {
    const { data, error } = await anon.from(table).select("*").limit(1);
    if (!error && data?.length) {
      issues.push(`[rls] anon peut lire ${table} sans auth`);
    } else if (error) {
      console.log(`[ok] anon bloqué sur ${table}`);
    } else {
      console.log(`[ok] anon ${table} vide ou inaccessible`);
    }
  }

  const { data: publicStores } = await anon
    .from("stores")
    .select("id, name, is_public")
    .eq("is_public", true)
    .limit(3);
  if (publicStores?.length) {
    console.log(
      `[ok] lecture publique stores (${publicStores.length} boutique(s) is_public=true — attendu)`
    );
  } else {
    console.log("[info] aucune boutique publique visible en anon");
  }

  const { data: privateStores } = await anon
    .from("stores")
    .select("id")
    .eq("is_public", false)
    .limit(1);
  if (privateStores?.length) {
    issues.push("[rls] anon peut lire des stores is_public=false");
  } else {
    console.log("[ok] stores privées non lisibles en anon");
  }
}

async function checkStorageUpload() {
  const path = `audit/${Date.now()}.txt`;
  const buffer = Buffer.from("wazo-audit");
  const { error } = await admin.storage.from("product-images").upload(path, buffer, {
    contentType: "text/plain",
    upsert: true,
  });
  if (error) {
    issues.push(`[storage] upload test échoué: ${error.message}`);
    return;
  }
  await admin.storage.from("product-images").remove([path]);
  console.log("[ok] upload storage product-images (service role)");
}

async function checkMigration013() {
  const { error } = await admin.from("blockchain_assets").select("celo_tx_hash").limit(1);
  if (error?.message?.includes("celo_tx_hash")) {
    issues.push("[migration] 013 Celo non appliquée (colonne celo_tx_hash absente)");
  } else if (error?.code === "42P01") {
    console.log("[info] table blockchain_assets absente (module non utilisé)");
  } else if (error) {
    issues.push(`[migration] blockchain_assets: ${error.message}`);
  } else {
    console.log("[ok] migration 013 Celo (colonnes présentes)");
  }
}

async function applyMigration014IfPossible() {
  if (!DB_URL) return;

  let postgres;
  try {
    postgres = (await import("postgres")).default;
  } catch {
    return;
  }

  const migrationPath = path.join(ROOT, "supabase/migrations/014_ensure_storage_buckets.sql");
  if (!fs.existsSync(migrationPath)) return;

  const sql = fs.readFileSync(migrationPath, "utf8");
  const db = postgres(DB_URL, { max: 1 });
  try {
    const applied = await db`
      SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '014'
    `;
    if (applied.length) {
      console.log("[ok] migration 014 déjà appliquée");
      return;
    }

    await db.unsafe(sql);
    await db`
      INSERT INTO supabase_migrations.schema_migrations (version)
      VALUES ('014')
      ON CONFLICT DO NOTHING
    `;
    fixes.push("migration 014 (buckets + politiques storage) appliquée");
    console.log("[fixed] migration 014 appliquée");
  } catch (e) {
    issues.push(`[migration] 014: ${e.message}`);
  } finally {
    await db.end({ timeout: 5 });
  }
}

async function checkStoragePoliciesSql() {
  if (!DB_URL) {
    console.log("[skip] SUPABASE_DB_URL absent — audit SQL (RLS storage, migrations) ignoré");
    console.log("       Ajoutez SUPABASE_DB_URL dans .env.local pour audit complet.");
    return;
  }

  let postgres;
  try {
    postgres = (await import("postgres")).default;
  } catch {
    issues.push("[sql] package postgres manquant — npm install postgres");
    return;
  }

  const db = postgres(DB_URL, { max: 1 });
  try {
    const migrations = await db`
      SELECT version FROM supabase_migrations.schema_migrations ORDER BY version
    `;
    const versions = new Set(migrations.map((r) => r.version));
    console.log(`[ok] ${versions.size} migrations appliquées`);

    const localFiles = fs
      .readdirSync(path.join(ROOT, "supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .map((f) => f.replace(/_.*$/, "").replace(/^(\d+)$/, "$1"));
    const localVersions = fs
      .readdirSync(path.join(ROOT, "supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .map((f) => f.split("_")[0]);

    for (const v of localVersions) {
      if (!versions.has(v)) {
        issues.push(`[migration] Non appliquée en prod: ${v}`);
      }
    }

    const noRls = await db`
      SELECT c.relname AS table_name
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND NOT c.relrowsecurity
        AND c.relname NOT LIKE 'pg_%'
      ORDER BY 1
    `;
    for (const row of noRls) {
      issues.push(`[security] RLS désactivé sur public.${row.table_name}`);
    }
    if (noRls.length === 0) console.log("[ok] RLS activé sur toutes les tables public");

    const buckets = await db`
      SELECT id, public FROM storage.buckets ORDER BY id
    `;
    const bucketIds = new Set(buckets.map((b) => b.id));
    for (const id of REQUIRED_BUCKETS) {
      if (!bucketIds.has(id)) issues.push(`[storage-db] Bucket absent en base: ${id}`);
    }

    const productPolicies = await db`
      SELECT policyname, cmd
      FROM pg_policies
      WHERE schemaname = 'storage' AND tablename = 'objects'
        AND policyname IN (
          'Authenticated upload images',
          'Public read images',
          'Owners delete images'
        )
    `;
    const cmds = new Set(productPolicies.map((p) => p.cmd));
    for (const cmd of ["INSERT", "SELECT", "DELETE"]) {
      if (![...productPolicies].some((p) => p.cmd === cmd && p.policyname.includes("images"))) {
        if (cmd === "INSERT" && !cmds.has("INSERT")) {
          issues.push("[storage-policy] Politique INSERT manquante pour product-images");
        }
      }
    }
    if (productPolicies.length >= 3) {
      console.log("[ok] politiques storage product-images présentes");
    } else {
      issues.push(
        `[storage-policy] Politiques product-images incomplètes (${productPolicies.length}/3 attendues)`
      );
    }

    const securityDefinerNoPath = await db`
      SELECT p.proname
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.prosecdef
        AND (p.proconfig IS NULL OR NOT EXISTS (
          SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%'
        ))
    `;
    for (const row of securityDefinerNoPath) {
      issues.push(`[security] FUNCTION ${row.proname}() SECURITY DEFINER sans search_path fixe`);
    }
    if (securityDefinerNoPath.length === 0) {
      console.log("[ok] fonctions SECURITY DEFINER avec search_path");
    }
  } catch (e) {
    issues.push(`[sql] ${e.message}`);
  } finally {
    await db.end({ timeout: 5 });
  }
}

async function main() {
  console.log("=== Audit Supabase ===\n");
  await checkBuckets();
  await checkTables();
  await checkAnonRls();
  await checkStorageUpload();
  await checkMigration013();
  await applyMigration014IfPossible();
  await checkStoragePoliciesSql();

  console.log("\n=== Résumé ===");
  if (fixes.length) {
    console.log(`Corrections appliquées (${fixes.length}):`);
    for (const f of fixes) console.log(`  + ${f}`);
  }
  if (issues.length === 0) {
    console.log("Aucun problème détecté.");
    return;
  }
  console.log(`${issues.length} problème(s):\n`);
  for (const i of issues) console.log(`  - ${i}`);

  process.exit(1);
}

main();
