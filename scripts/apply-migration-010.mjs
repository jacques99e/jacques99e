/**
 * Applique la migration 010 via l'API SQL Supabase Management (si SUPABASE_ACCESS_TOKEN)
 * ou via DATABASE_URL / SUPABASE_DB_URL (connexion Postgres directe).
 */
import fs from "fs";
import path from "path";
import pg from "pg";

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

const env = loadEnv(path.join(process.cwd(), ".env.local"));
const sqlPath = path.join(process.cwd(), "supabase", "migrations", "010_education_quiz_subtitles.sql");
const sql = fs.readFileSync(sqlPath, "utf8");

const dbUrl =
  env.DATABASE_URL ||
  env.SUPABASE_DB_URL ||
  env.POSTGRES_URL ||
  process.env.DATABASE_URL;

async function applyViaPg(connectionString) {
  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(sql);
    console.log("Migration 010 appliquée via Postgres.");
  } finally {
    await client.end();
  }
}

async function applyViaManagementApi() {
  const token = env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_ACCESS_TOKEN;
  const ref = env.SUPABASE_PROJECT_REF || new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
  if (!token) return false;

  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("Management API error:", res.status, body);
    return false;
  }
  console.log("Migration 010 appliquée via Supabase Management API.");
  return true;
}

if (dbUrl) {
  await applyViaPg(dbUrl);
} else if (await applyViaManagementApi()) {
  // done
} else {
  console.error(
    "Impossible d'appliquer automatiquement. Ajoutez DATABASE_URL dans .env.local\n" +
      "ou SUPABASE_ACCESS_TOKEN, ou exécutez le SQL manuellement dans le dashboard Supabase :\n" +
      sqlPath
  );
  process.exit(1);
}
