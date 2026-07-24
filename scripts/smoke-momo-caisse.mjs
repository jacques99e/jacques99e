/**
 * Smoke-test PayDunya live checkout for caisse (no auth, no fulfill).
 * Creates a 200 XOF invoice and prints checkout URL — does NOT mark a sale.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = {
  ...loadEnv(path.join(ROOT, ".env.local")),
  ...process.env,
};

const master = env.PAYMENT_API_KEY;
const priv = env.PAYMENT_SECRET_KEY;
const token = env.PAYMENT_TOKEN;
const mode = (env.PAYMENT_MODE || "live").toLowerCase();
const appUrl = (env.NEXT_PUBLIC_APP_URL || "https://app.wazo-digital.com").replace(/\/$/, "");

console.log("=== MoMo caisse smoke (PayDunya) ===");
console.log("mode:", mode);
console.log("keys:", {
  master: master ? `${master.slice(0, 6)}…` : "MISSING",
  private: priv ? `${priv.slice(0, 6)}…` : "MISSING",
  token: token ? `${token.slice(0, 6)}…` : "MISSING",
  callbackSecret: env.PAYMENT_CALLBACK_SECRET ? "SET" : "MISSING",
});

if (!master || !priv || !token) {
  console.error("FAIL: clés PayDunya manquantes dans .env.local");
  process.exit(1);
}

const checkoutUrl =
  mode === "live" || mode === "prod" || mode === "production"
    ? "https://app.paydunya.com/api/v1/checkout-invoice/create"
    : "https://app.paydunya.com/sandbox-api/v1/checkout-invoice/create";

const tx = `SALE-SMOKE-${Date.now()}`;
const callbackSecret = env.PAYMENT_CALLBACK_SECRET?.trim() || "";
const callbackQuery = new URLSearchParams({ tx, kind: "sale" });
if (callbackSecret) callbackQuery.set("secret", callbackSecret);

const body = {
  invoice: {
    total_amount: 200,
    description: `Wazo smoke MoMo caisse — 200 FCFA (${tx})`,
  },
  store: { name: "Wazo Digital" },
  custom_data: { wazo_tx: tx, kind: "sale", smoke: true },
  actions: {
    callback_url: `${appUrl}/api/payments/momo/callback?${callbackQuery.toString()}`,
    return_url: `${appUrl}/sales?tx=${encodeURIComponent(tx)}&momo=1`,
    cancel_url: `${appUrl}/sales?tx=${encodeURIComponent(tx)}&momo=1&status=cancelled`,
  },
};

const res = await fetch(checkoutUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "PAYDUNYA-MASTER-KEY": master,
    "PAYDUNYA-PRIVATE-KEY": priv,
    "PAYDUNYA-TOKEN": token,
  },
  body: JSON.stringify(body),
});

const raw = await res.text();
let data;
try {
  data = JSON.parse(raw);
} catch {
  console.error("FAIL: réponse non JSON", raw.slice(0, 400));
  process.exit(1);
}

const link =
  typeof data.response_text === "string" && data.response_text.startsWith("http")
    ? data.response_text
    : typeof data.url === "string"
      ? data.url
      : null;

console.log("http:", res.status);
console.log("response_code:", data.response_code);
console.log("checkout_url:", link || "(none)");
if (data.response_code !== "00" || !link) {
  console.error("FAIL:", data.response_text || data.description || JSON.stringify(data).slice(0, 500));
  process.exit(1);
}

console.log("OK — PayDunya live crée bien une facture caisse.");
console.log("Ouvre le lien pour payer 200 FCFA (optionnel) puis tu reviens sur /sales.");
console.log(link);
