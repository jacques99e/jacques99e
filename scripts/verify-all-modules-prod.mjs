#!/usr/bin/env node
/**
 * Vérification prod authentifiée — pages et APIs par module.
 * Usage: node scripts/verify-all-modules-prod.mjs
 */

import fs from "node:fs";
import path from "node:path";

const APP = process.env.APP_URL || "https://wazo-digital.vercel.app";
const envPath = path.join(process.cwd(), ".env.local");
const env = Object.fromEntries(
  fs
    .readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    })
);

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const OWNER_EMAIL = process.env.E2E_OWNER_EMAIL || "test.owner@wazo.africa";
const OWNER_PASSWORD = process.env.E2E_OWNER_PASSWORD || "TestOwner2026!";

const MODULE_ROUTES = {
  commerce: ["/products", "/sales", "/clients", "/sales/liens", "/sales/credit", "/sales/voice", "/sales/tontine"],
  agriculture: ["/agriculture", "/agriculture/parcels/new", "/agriculture/marches", "/agriculture/radar", "/agriculture/calendrier"],
  health: ["/health", "/health/patients/new", "/health/appointments", "/health/sentinel", "/health/pharmacie"],
  logistics: ["/logistics", "/logistics/deliveries/new", "/logistics/fleet", "/logistics/tournee"],
  education: ["/education", "/education/courses/new", "/education/badges", "/education/presence"],
  blockchain: ["/blockchain", "/blockchain/assets/new", "/blockchain/contracts", "/blockchain/passport", "/blockchain/qr"],
};

const CORE = ["/dashboard", "/analytics", "/nexus", "/settings", "/settings/team", "/settings/notifications", "/help", "/modules"];

const APIS = [
  ["GET", "/api/payments/momo-link/history"],
  ["GET", "/api/payments/momo-link/summary"],
  ["GET", "/api/payments/momo-link/analytics"],
  ["GET", "/api/payments/momo-link/reconciliation"],
  ["GET", "/api/education/courses"],
  ["GET", "/api/logistics/deliveries"],
  ["GET", "/api/blockchain/assets"],
  ["GET", "/api/health/prescriptions"],
  ["GET", "/api/billing/subscription"],
  ["GET", "/api/reports/settings"],
];

async function getToken() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: OWNER_EMAIL, password: OWNER_PASSWORD }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.msg || json.error_description || `Auth ${res.status}`);
  return json.access_token;
}

async function checkPage(token, route) {
  const res = await fetch(`${APP}${route}`, {
    headers: { Cookie: `sb-access-token=${token}` },
    redirect: "manual",
  });
  const ok = res.status === 200;
  return { route, status: res.status, ok };
}

async function checkApi(token, method, route) {
  const res = await fetch(`${APP}${route}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Cookie: `sb-access-token=${token}`,
    },
  });
  const ok = res.status < 500;
  let detail = "";
  try {
    const j = await res.json();
    detail = j.error || j.success === false ? String(j.error || "error") : "";
  } catch {
    /* ignore */
  }
  return { route, status: res.status, ok, detail };
}

let passed = 0;
let failed = 0;
const failures = [];

function report(name, ok, extra = "") {
  console.log(`${ok ? "OK" : "FAIL"}  ${name}${extra ? ` — ${extra}` : ""}`);
  if (ok) passed++;
  else {
    failed++;
    failures.push(name + (extra ? ` (${extra})` : ""));
  }
}

console.log(`\nVérification modules — ${APP} (${OWNER_EMAIL})\n`);

const token = await getToken();
console.log("Auth OK\n");

for (const route of CORE) {
  const r = await checkPage(token, route);
  report(`core ${route}`, r.ok || [307, 308].includes(r.status), `HTTP ${r.status}`);
}

for (const [mod, routes] of Object.entries(MODULE_ROUTES)) {
  console.log(`\n— ${mod.toUpperCase()} —`);
  for (const route of routes) {
    const r = await checkPage(token, route);
    report(`${mod} ${route}`, r.ok || [307, 308].includes(r.status), `HTTP ${r.status}`);
  }
}

console.log("\n— APIs —");
for (const [method, route] of APIS) {
  const r = await checkApi(token, method, route);
  report(`API ${method} ${route}`, r.ok, `HTTP ${r.status}${r.detail ? ` ${r.detail}` : ""}`);
}

console.log(`\nRésultat: ${passed} OK, ${failed} FAIL`);
if (failures.length) {
  console.log("\nÉchecs:");
  failures.forEach((f) => console.log(`  • ${f}`));
}
process.exit(failed > 0 ? 1 : 0);
