/**
 * Supprime TOUS les comptes auth et données associées (boutiques, produits, etc.).
 *
 * Usage:
 *   PURGE_CONFIRM=YES node scripts/purge-all-accounts.mjs
 *
 * Irréversible. Nécessite SUPABASE_SERVICE_ROLE_KEY dans .env.local
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
    out[trimmed.slice(0, idx).trim()] = value;
  }
  return out;
}

const env = {
  ...loadEnvFile(path.join(ROOT, ".env.local")),
  ...loadEnvFile(path.join(ROOT, ".env.vercel.production")),
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

if (process.env.PURGE_CONFIRM !== "YES") {
  console.error(
    "Opération destructive bloquée.\n" +
      "Relancez avec: PURGE_CONFIRM=YES node scripts/purge-all-accounts.mjs"
  );
  process.exit(1);
}

if (!supabaseUrl || !serviceKey) {
  console.error("Manque NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const STORAGE_BUCKETS = ["product-images", "course-media", "certificates"];

async function countTable(table) {
  const { count, error } = await admin
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) return `? (${error.message})`;
  return count ?? 0;
}

async function listAllUsers() {
  const users = [];
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const batch = data?.users ?? [];
    users.push(...batch);
    if (batch.length < 200) break;
    page += 1;
  }
  return users;
}

async function emptyBucket(bucket) {
  let removed = 0;

  async function removePrefix(prefix = "") {
    const { data: entries, error } = await admin.storage.from(bucket).list(prefix, {
      limit: 1000,
    });
    if (error) {
      console.warn(`  [storage] ${bucket}/${prefix}: ${error.message}`);
      return;
    }
    for (const entry of entries ?? []) {
      const itemPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) {
        await removePrefix(itemPath);
      } else {
        const { error: delErr } = await admin.storage.from(bucket).remove([itemPath]);
        if (!delErr) removed += 1;
      }
    }
  }

  await removePrefix("");
  return removed;
}

async function main() {
  console.log("=== Purge complète Wazo Digital ===\n");

  const usersBefore = await listAllUsers();
  console.log(`Comptes auth trouvés: ${usersBefore.length}`);
  for (const u of usersBefore) {
    console.log(`  - ${u.email || u.phone || u.id}`);
  }

  console.log("\nAvant suppression — données:");
  for (const table of ["profiles", "stores", "products", "courses", "deliveries"]) {
    console.log(`  ${table}: ${await countTable(table)}`);
  }

  console.log("\n1) Vidage des buckets storage...");
  for (const bucket of STORAGE_BUCKETS) {
    const n = await emptyBucket(bucket);
    console.log(`  ${bucket}: ${n} fichier(s) supprimé(s)`);
  }

  console.log("\n2) Détachement des références auth sans CASCADE...");
  for (const [table, col] of [
    ["deliveries", "driver_id"],
    ["messages", "sender_id"],
    ["health_patients", "owner_id"],
  ]) {
    const { error } = await admin.from(table).update({ [col]: null }).not(col, "is", null);
    if (error) console.warn(`  ${table}.${col}: ${error.message}`);
  }

  console.log("\n3) Suppression des boutiques restantes...");
  const { data: stores } = await admin.from("stores").select("id, slug");
  for (const store of stores ?? []) {
    const { error } = await admin.from("stores").delete().eq("id", store.id);
    if (error) console.warn(`  store ${store.slug}: ${error.message}`);
    else console.log(`  boutique supprimée: ${store.slug}`);
  }

  console.log("\n4) Suppression des profils orphelins...");
  const { data: profiles } = await admin.from("profiles").select("id");
  for (const profile of profiles ?? []) {
    await admin.from("profiles").delete().eq("id", profile.id);
  }

  console.log("\n5) Suppression des comptes auth...");
  let deleted = 0;
  let failed = 0;
  for (const user of usersBefore) {
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) {
      console.error(`  ERREUR ${user.email || user.id}: ${error.message}`);
      failed += 1;
    } else {
      console.log(`  supprimé: ${user.email || user.phone || user.id}`);
      deleted += 1;
    }
  }

  const usersAfter = await listAllUsers();
  console.log("\nAprès suppression:");
  console.log(`  Comptes auth: ${usersAfter.length} (supprimés: ${deleted}, erreurs: ${failed})`);
  for (const table of ["profiles", "stores", "products", "courses", "deliveries", "crm_clients", "sales"]) {
    console.log(`  ${table}: ${await countTable(table)}`);
  }

  if (usersAfter.length > 0 || failed > 0) {
    console.error("\nPurge incomplète — vérifiez les erreurs ci-dessus.");
    process.exit(1);
  }

  console.log("\nPurge terminée. Base prête pour de nouveaux inscrits.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
