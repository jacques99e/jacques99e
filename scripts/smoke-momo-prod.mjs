#!/usr/bin/env node
/**
 * Smoke test MoMo en production (sans auth utilisateur).
 * Usage: node scripts/smoke-momo-prod.mjs
 * Option: CRON_SECRET=xxx node scripts/smoke-momo-prod.mjs  (teste aussi le cron)
 */

const APP = process.env.APP_URL || "https://wazo-digital.vercel.app";
const LANDING = process.env.LANDING_URL || "https://landing-jacques99e.vercel.app";

async function check(name, url, { expect = [200], headers } = {}) {
  const res = await fetch(url, { headers, redirect: "manual" });
  const ok = expect.includes(res.status);
  const mark = ok ? "OK" : "FAIL";
  console.log(`${mark}  ${name} → ${res.status} ${url}`);
  return ok;
}

let passed = 0;
let failed = 0;

async function run() {
  console.log(`\nSmoke MoMo — ${APP}\n`);

  const tests = [
    ["cron momo-reminders (sans auth → 401)", `${APP}/api/cron/momo-reminders`, { expect: [401] }],
    ["history (sans auth → 401)", `${APP}/api/payments/momo-link/history`, { expect: [401] }],
    ["summary (sans auth → 401)", `${APP}/api/payments/momo-link/summary`, { expect: [401] }],
    ["analytics (sans auth → 401)", `${APP}/api/payments/momo-link/analytics`, { expect: [401] }],
    ["page paiement public", `${APP}/paiement/WZTEST`, { expect: [200, 404] }],
    ["landing #premium", `${LANDING}/`, { expect: [200] }],
  ];

  for (const [name, url, opts] of tests) {
    if (await check(name, url, opts)) passed++;
    else failed++;
  }

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const res = await fetch(`${APP}/api/cron/momo-reminders`, {
      headers: { Authorization: `Bearer ${cronSecret}` },
    });
    const json = await res.json().catch(() => ({}));
    const ok = res.ok && json.success;
    console.log(`${ok ? "OK" : "FAIL"}  cron momo-reminders (avec secret) → ${res.status}`, json);
    if (ok) passed++;
    else failed++;
  } else {
    console.log("SKIP cron avec secret (CRON_SECRET non défini)");
  }

  console.log(`\nRésultat: ${passed} OK, ${failed} FAIL\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
