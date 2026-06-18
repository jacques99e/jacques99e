#!/usr/bin/env node
/**
 * Audit Vercel production (sans CLI) : health, crons, déploiements récents.
 */
const APP_HEALTH = process.env.MONITOR_APP_URL?.trim() || "https://app.wazo-digital.com/api/health";
const LANDING_HEALTH =
  process.env.MONITOR_LANDING_URL?.trim() || "https://wazo-digital.com/api/health";
const LANDING_ORIGIN = LANDING_HEALTH.replace(/\/api\/health\/?$/, "");
const APP_ORIGIN = APP_HEALTH.replace(/\/api\/health\/?$/, "");

const issues = [];
const warnings = [];

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

async function checkHealth(name, url) {
  const { res, body } = await fetchJson(url);
  if (!res.ok || body.ok !== true) {
    issues.push(`${name}: health KO (${res.status})`);
    return null;
  }
  console.log(`[ok] ${name} v${body.version ?? "?"}`);
  return body;
}

async function checkAppConfig(health) {
  if (!health) return;

  if ("serviceRole" in health && health.serviceRole === false) {
    issues.push("app: SUPABASE_SERVICE_ROLE_KEY manquant sur Vercel");
  } else if (health.serviceRole === true) {
    console.log("[ok] app service role configuré");
  }

  if (health.crons && "configured" in health.crons && health.crons.configured === false) {
    issues.push(
      "app: CRON_SECRET manquant — crons Vercel (rapport, push, indexation) renvoient 401"
    );
  } else if (health.crons?.configured === true) {
    console.log("[ok] app CRON_SECRET configuré");
  } else if (!("crons" in health)) {
    warnings.push(
      "app: health sans champ crons — déployez la dernière version puis relancez audit:vercel"
    );
  }

  if ("email" in health) {
    if (!health.email?.resendConfigured && !health.email?.simulate) {
      warnings.push("app: RESEND_API_KEY absent — rapports hebdo désactivés");
    } else {
      console.log("[ok] app email (Resend ou simulation)");
    }
  }

  if ("push" in health) {
    if (!health.push?.configured) {
      warnings.push("app: clés VAPID absentes — alertes push cron inactives");
    } else {
      console.log("[ok] app push VAPID configuré");
    }
  }

  if (health.payment && !health.payment.paydunyaConfigured) {
    warnings.push("app: clés PayDunya incomplètes");
  }

  if (health.celo && !health.celo.configured) {
    warnings.push("app: Celo non configuré (traçabilité on-chain)");
  }
}

async function checkCronGuard() {
  const res = await fetch(`${APP_ORIGIN}/api/cron/weekly-report`, { cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  if (res.status === 401 && body.error === "Unauthorized") {
    console.log("[ok] crons protégés (401 sans secret)");
    return;
  }
  if (res.status === 200) {
    warnings.push("cron: accessible sans Authorization — vérifier CRON_SECRET en prod");
    return;
  }
  warnings.push(`cron: réponse inattendue ${res.status}`);
}

async function checkPublicPages() {
  const landingPages = ["/", "/guide-pilote"];
  for (const p of landingPages) {
    const url = `${LANDING_ORIGIN}${p}`;
    const res = await fetch(url, { cache: "no-store", redirect: "follow" });
    if (res.status >= 500) {
      issues.push(`landing ${p}: HTTP ${res.status}`);
    } else {
      console.log(`[ok] landing ${p} → ${res.status}`);
    }
  }

  const appPath = "/boutique/boutique-test-roles-wazo";
  const res = await fetch(`${APP_ORIGIN}${appPath}`, { cache: "no-store", redirect: "follow" });
  if (res.status >= 500) {
    issues.push(`app ${appPath}: HTTP ${res.status}`);
  } else {
    console.log(`[ok] app ${appPath} → ${res.status}`);
  }
}

async function main() {
  console.log("=== Audit Vercel (production) ===\n");

  const landing = await checkHealth("landing", LANDING_HEALTH);
  const app = await checkHealth("app", APP_HEALTH);

  if (landing && !landing.supabase) {
    warnings.push("landing: variables Supabase publiques manquantes");
  }
  if (landing && !landing.appUrl) {
    warnings.push("landing: NEXT_PUBLIC_APP_URL manquant");
  }

  await checkAppConfig(app);
  await checkCronGuard();
  await checkPublicPages();

  console.log("\n=== Résumé ===");
  if (warnings.length) {
    console.log(`Avertissements (${warnings.length}):`);
    for (const w of warnings) console.log(`  ! ${w}`);
  }
  if (issues.length === 0) {
    console.log("Aucune erreur bloquante détectée.");
    if (warnings.length) process.exit(0);
    return;
  }
  console.log(`Erreurs (${issues.length}):`);
  for (const i of issues) console.log(`  - ${i}`);
  console.log("\n→ Corriger : vercel login puis");
  console.log("  powershell -ExecutionPolicy Bypass -File scripts/setup-vercel-sync-notify.ps1");
  console.log("  powershell -ExecutionPolicy Bypass -File scripts/setup-vercel-payment-live.ps1");
  process.exit(1);
}

main();
