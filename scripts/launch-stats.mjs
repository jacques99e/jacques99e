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
  ...Object.fromEntries(
    ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"].map((k) => [
      k,
      process.env[k],
    ]).filter(([, v]) => v)
  ),
};

const SUPA = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPA || !SERVICE) {
  console.error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis.");
  process.exit(1);
}

const admin = createClient(SUPA, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TEST_EMAIL_SUFFIX = "@wazo.africa";

async function countTable(table) {
  const { count, error } = await admin.from(table).select("*", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

async function main() {
  const since = new Date();
  since.setDate(since.getDate() - 7);
  const sinceIso = since.toISOString();

  const [stores, profiles, products, sales, recentStores] = await Promise.all([
    countTable("stores"),
    countTable("profiles"),
    countTable("products"),
    countTable("sales"),
    admin
      .from("stores")
      .select("name, slug, created_at, owner_id")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false }),
  ]);

  const { data: profileRows } = await admin.from("profiles").select("id, phone, full_name");
  const ownerIds = new Set((recentStores.data || []).map((s) => s.owner_id));

  let testAccounts = 0;
  const { data: usersData } = await admin.auth.admin.listUsers({ perPage: 200 });
  for (const u of usersData?.users || []) {
    if (u.email?.endsWith(TEST_EMAIL_SUFFIX)) testAccounts++;
  }

  const realStores = (recentStores.data || []).filter(
    (s) => !String(s.slug || "").includes("test-roles")
  );

  console.log("=== Wazo Digital — stats lancement ===\n");
  console.log(`Comptes auth total     : ${usersData?.users?.length ?? "?"}`);
  console.log(`Comptes test (@wazo)   : ${testAccounts}`);
  console.log(`Profils                : ${profiles}`);
  console.log(`Boutiques              : ${stores}`);
  console.log(`Produits               : ${products}`);
  console.log(`Ventes                 : ${sales}`);
  console.log(`\nNouvelles boutiques (7j): ${realStores.length}`);
  for (const s of realStores) {
    console.log(`  · ${s.name} (${s.slug}) — ${s.created_at?.slice(0, 10)}`);
  }

  if (realStores.length === 0) {
    console.log("\n→ Invitez vos pilotes : https://wazo-digital.com/guide-pilote");
  } else if (products === 0) {
    console.log("\n→ Les boutiques existent mais aucun produit cloud : rappeler la sync.");
  } else {
    console.log("\n→ Progression OK. Relancez les pilotes sans produit via audit:cloud.");
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
