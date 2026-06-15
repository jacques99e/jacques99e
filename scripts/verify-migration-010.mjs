/**
 * Vérifie que la migration 010_education_quiz_subtitles est appliquée en prod.
 * Usage: node scripts/verify-migration-010.mjs
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

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
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis dans .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const CHECKS = [
  { table: "course_modules", column: "subtitles" },
  { table: "course_quizzes", column: "module_id" },
  { table: "course_enrollments", column: "progress_meta" },
];

let allOk = true;

for (const { table, column } of CHECKS) {
  const { error } = await supabase.from(table).select(column).limit(1);
  if (error) {
    console.log(`MISSING ${table}.${column} — ${error.message}`);
    allOk = false;
  } else {
    console.log(`OK ${table}.${column}`);
  }
}

if (allOk) {
  console.log("\nMigration 010 : APPLIQUÉE (colonnes présentes).");
  process.exit(0);
}

console.log("\nMigration 010 : NON APPLIQUÉE — exécutez le SQL dans supabase/migrations/010_education_quiz_subtitles.sql");
process.exit(1);
