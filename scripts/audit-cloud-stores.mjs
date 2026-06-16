import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(import.meta.dirname, "..");

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

const SUPA = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const APP = (env.NEXT_PUBLIC_APP_URL || "https://app.wazo-digital.com").replace(/\/$/, "");

if (!SUPA || !SERVICE) {
  console.error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis.");
  process.exit(1);
}

const admin = createClient(SUPA, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function auditStore(store) {
  const issues = [];
  const { id, slug, name, whatsapp, phone } = store;

  const { count: productCount } = await admin
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("store_id", id);

  const { data: productsNoPhoto } = await admin
    .from("products")
    .select("name")
    .eq("store_id", id)
    .is("photo_url", null)
    .limit(5);

  if (!whatsapp && !phone) {
    issues.push("WhatsApp/téléphone manquant");
  }
  if ((productCount ?? 0) > 0 && productsNoPhoto?.length) {
    issues.push(`${productsNoPhoto.length}+ produit(s) sans photo`);
  }

  const { data: courses } = await admin.from("courses").select("id, title, invite_code").eq("store_id", id);
  for (const course of courses || []) {
    const { count } = await admin
      .from("course_modules")
      .select("id", { count: "exact", head: true })
      .eq("course_id", course.id);
    if ((count ?? 0) === 0) {
      issues.push(`Cours « ${course.title} » sans module (code ${course.invite_code || "—"})`);
    }
  }

  const { count: deliveryCount } = await admin
    .from("deliveries")
    .select("id", { count: "exact", head: true })
    .eq("store_id", id);

  return {
    slug,
    name,
    products: productCount ?? 0,
    courses: courses?.length ?? 0,
    deliveries: deliveryCount ?? 0,
    issues,
  };
}

const slugFilter = process.argv[2]?.trim();

let query = admin.from("stores").select("id, slug, name, whatsapp, phone").order("created_at");
if (slugFilter) query = query.eq("slug", slugFilter);

const { data: stores, error } = await query;
if (error) {
  console.error(error.message);
  process.exit(1);
}

console.log(`=== Audit cloud Wazo (${stores?.length ?? 0} boutique(s)) ===\n`);

let problemStores = 0;
for (const store of stores || []) {
  const report = await auditStore(store);
  const flag = report.issues.length ? "⚠" : "✓";
  console.log(`${flag} ${report.slug} — ${report.name}`);
  console.log(
    `   produits=${report.products} · cours=${report.courses} · livraisons=${report.deliveries}`
  );
  if (report.issues.length) {
    problemStores++;
    for (const issue of report.issues) console.log(`   → ${issue}`);
  }
  console.log("");
}

if (problemStores > 0) {
  console.log(`${problemStores} boutique(s) avec données incomplètes.`);
  console.log("Action: Paramètres > Notifications & sync > « Synchroniser maintenant » sur l'appareil source.");
  process.exit(1);
}

console.log("Toutes les boutiques auditées sont complètes côté cloud.");
