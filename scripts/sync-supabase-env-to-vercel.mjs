import fs from "fs";
import { execSync } from "child_process";

function load(file) {
  const env = {};
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

const local = load(".env.local");
const pairs = [
  ["NEXT_PUBLIC_SUPABASE_URL", local.NEXT_PUBLIC_SUPABASE_URL || local.SUPABASE_URL],
  ["NEXT_PUBLIC_SUPABASE_ANON_KEY", local.NEXT_PUBLIC_SUPABASE_ANON_KEY],
  ["SUPABASE_SERVICE_ROLE_KEY", local.SUPABASE_SERVICE_ROLE_KEY],
];

for (const [key, value] of pairs) {
  if (!value) {
    console.error("Missing local value for", key);
    process.exit(1);
  }
  console.log("Updating", key, "…");
  try {
    execSync(`vercel env rm ${key} production --yes`, { stdio: "pipe" });
  } catch {
    // may not exist / empty
  }
  execSync(`vercel env add ${key} production`, {
    input: value + "\n",
    stdio: ["pipe", "inherit", "inherit"],
  });
}

console.log("Done. Redeploy required.");
