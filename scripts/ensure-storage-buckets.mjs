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
    ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]
      .map((k) => [k, process.env[k]])
      .filter(([, v]) => v)
  )
);

const SUPA = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPA || !SERVICE) {
  console.error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis.");
  process.exit(1);
}

/** Buckets requis par l'app (id, public). */
const BUCKETS = [
  { id: "product-images", public: true },
  { id: "course-media", public: true },
  { id: "certificates", public: true },
  { id: "health-docs", public: false },
];

const admin = createClient(SUPA, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const { data: existing, error: listErr } = await admin.storage.listBuckets();
  if (listErr) {
    console.error("listBuckets:", listErr.message);
    process.exit(1);
  }

  const ids = new Set((existing || []).map((b) => b.id));

  for (const bucket of BUCKETS) {
    if (ids.has(bucket.id)) {
      console.log(`[ok] ${bucket.id} existe déjà`);
      continue;
    }

    const { error } = await admin.storage.createBucket(bucket.id, {
      public: bucket.public,
      fileSizeLimit: 10 * 1024 * 1024,
    });

    if (error) {
      console.error(`[fail] ${bucket.id}:`, error.message);
      process.exit(1);
    }
    console.log(`[created] ${bucket.id} (public=${bucket.public})`);
  }

  console.log("\nBuckets storage prêts.");
}

main();
