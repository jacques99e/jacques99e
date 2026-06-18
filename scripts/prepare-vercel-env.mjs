#!/usr/bin/env node
/**
 * Prépare .env.local pour sync Vercel (CRON_SECRET, VAPID si absents).
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(ROOT, ".env.local");

function readEnv() {
  if (!fs.existsSync(envPath)) return { text: "", map: new Map() };
  const text = fs.readFileSync(envPath, "utf8");
  const map = new Map();
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    map.set(t.slice(0, i).trim(), t.slice(i + 1).trim());
  }
  return { text, map };
}

function appendEnv(key, value) {
  const line = `${key}=${value}\n`;
  fs.appendFileSync(envPath, (fs.existsSync(envPath) && !readEnv().text.endsWith("\n") ? "\n" : "") + line);
  console.log(`[added] ${key}`);
}

const { map } = readEnv();
const fixes = [];

if (!map.get("CRON_SECRET")) {
  appendEnv("CRON_SECRET", crypto.randomBytes(32).toString("hex"));
  fixes.push("CRON_SECRET");
}

const hasVapid = map.get("NEXT_PUBLIC_VAPID_PUBLIC_KEY") && map.get("VAPID_PRIVATE_KEY");
if (!hasVapid) {
  const result = spawnSync("npx", ["web-push", "generate-vapid-keys"], {
    cwd: ROOT,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  const out = `${result.stdout}\n${result.stderr}`;
  const pub = out.match(/Public Key:\s*(\S+)/)?.[1];
  const priv = out.match(/Private Key:\s*(\S+)/)?.[1];
  if (pub && priv) {
    appendEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", pub);
    appendEnv("VAPID_PRIVATE_KEY", priv);
    if (!map.get("VAPID_SUBJECT")) {
      appendEnv("VAPID_SUBJECT", "mailto:support@wazo-digital.app");
    }
    fixes.push("VAPID");
  } else {
    console.warn("[skip] VAPID — exécutez: npx web-push generate-vapid-keys");
  }
}

if (fixes.length === 0) {
  console.log("[ok] .env.local déjà prêt pour Vercel (CRON + VAPID).");
} else {
  console.log(`\n[done] Ajouté: ${fixes.join(", ")}`);
}

console.log(`
Prochaine étape (sync vers Vercel Production) :
  1. vercel login
  2. vercel link   (projet wazo-digital, si pas déjà fait)
  3. powershell -ExecutionPolicy Bypass -File scripts/setup-vercel-sync-notify.ps1
  4. npx vercel --prod --yes
`);
