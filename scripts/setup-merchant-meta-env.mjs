#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LANDING = path.resolve(ROOT, "..", "Landing");

function load(p) {
  const o = {};
  if (!fs.existsSync(p)) return o;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    o[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return o;
}

function upsert(file, vars) {
  let content = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  for (const [k, v] of Object.entries(vars)) {
    const re = new RegExp(`^${k}=.*$`, "m");
    const line = `${k}=${v}`;
    if (re.test(content)) content = content.replace(re, line);
    else content = `${content.trimEnd()}\n${line}\n`;
  }
  fs.writeFileSync(file, content.endsWith("\n") ? content : `${content}\n`);
}

const landing = load(path.join(LANDING, ".env.local"));
const app = load(path.join(ROOT, ".env.local"));
const appId = landing.META_APP_ID || app.META_APP_ID;
const appSecret = landing.META_APP_SECRET || app.META_APP_SECRET;
if (!appId || !appSecret) {
  console.error("META_APP_ID / META_APP_SECRET manquants (Landing ou app .env.local)");
  process.exit(1);
}

upsert(path.join(ROOT, ".env.local"), {
  META_APP_ID: appId,
  META_APP_SECRET: appSecret,
});
console.log("[ok] .env.local META_*");

const vercelDir = path.join(ROOT, ".vercel");
if (!fs.existsSync(vercelDir)) fs.mkdirSync(vercelDir);
fs.writeFileSync(
  path.join(vercelDir, "project.json"),
  JSON.stringify(
    {
      projectId: "prj_need_resolve",
      orgId: "team_pWziSLXvlndDqnDoTBRAYe5X",
      projectName: "wazo-digital",
    },
    null,
    2
  )
);

try {
  const out = execSync(
    "npx vercel api \"/v9/projects/wazo-digital?teamId=team_pWziSLXvlndDqnDoTBRAYe5X\"",
    { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  );
  const m = out.match(/"id"\s*:\s*"(prj_[^"]+)"/);
  if (m) {
    fs.writeFileSync(
      path.join(vercelDir, "project.json"),
      JSON.stringify(
        {
          projectId: m[1],
          orgId: "team_pWziSLXvlndDqnDoTBRAYe5X",
          projectName: "wazo-digital",
        },
        null,
        2
      )
    );
    console.log("[ok] vercel project", m[1]);
  }
} catch (e) {
  console.log("[warn] resolve project:", e.message?.slice(0, 120));
}

for (const [k, v] of [
  ["META_APP_ID", appId],
  ["META_APP_SECRET", appSecret],
]) {
  try {
    try {
      execSync(`npx vercel env rm ${k} production -y`, {
        cwd: ROOT,
        stdio: "ignore",
      });
    } catch {
      /* ignore */
    }
    execSync(`npx vercel env add ${k} production`, {
      cwd: ROOT,
      input: `${v}\n`,
      stdio: ["pipe", "pipe", "pipe"],
      encoding: "utf8",
    });
    console.log("[ok] vercel", k);
  } catch (e) {
    console.log("[fail] vercel", k, String(e.stderr || e.message).slice(0, 160));
  }
}

console.log("\nSQL à coller dans Supabase SQL Editor:");
console.log("  supabase/migrations/019_store_social_accounts.sql");
console.log("\nURI OAuth à ajouter dans Meta Facebook Login:");
console.log("  https://app.wazo-digital.com/api/social/meta/callback");
