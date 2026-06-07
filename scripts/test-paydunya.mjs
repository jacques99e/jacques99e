import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const env = readFileSync(resolve(root, ".env.local"), "utf8");
const get = (key) => {
  const m = env.match(new RegExp(`^${key}=(.*)$`, "m"));
  return m?.[1]?.trim() ?? "";
};

const master = get("PAYMENT_API_KEY");
const priv = get("PAYMENT_SECRET_KEY");
const token = get("PAYMENT_TOKEN");

console.log("keys_present", {
  master: Boolean(master),
  private: Boolean(priv),
  token: Boolean(token),
  master_len: master.length,
});

const res = await fetch("https://app.paydunya.com/sandbox-api/v1/checkout-invoice/create", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "PAYDUNYA-MASTER-KEY": master,
    "PAYDUNYA-PRIVATE-KEY": priv,
    "PAYDUNYA-TOKEN": token,
  },
  body: JSON.stringify({
    invoice: { total_amount: 9900, description: "Wazo test" },
    store: { name: "Wazo Digital" },
  }),
});

const data = await res.json();
console.log("http_status", res.status);
console.log("response", JSON.stringify(data, null, 2));
