import type { SupabaseClient } from "@supabase/supabase-js";
import { sendWeeklyReportEmail } from "@/lib/email";
import { PROD_LANDING_URL } from "@/lib/site-urls";

const SKIP_SLUGS = new Set(["hbk-boutyk-237"]);

function landingAlertUrl() {
  const base =
    process.env.NEXT_PUBLIC_LANDING_URL?.trim().replace(/\/$/, "") || PROD_LANDING_URL;
  return `${base}/api/signup-alert`;
}

async function postMerchantAlert(payload: {
  name: string;
  email: string;
  whatsapp: string;
  store: string;
  slug: string;
  stage: string;
  utm: string;
  note: string;
}): Promise<void> {
  const secret =
    process.env.SIGNUP_ALERT_SECRET?.trim() || process.env.CRON_SECRET?.trim() || "";
  await fetch(landingAlertUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(secret
        ? { Authorization: `Bearer ${secret}`, "x-wazo-alert-secret": secret }
        : {}),
    },
    body: JSON.stringify(payload),
  });
}

async function storeOwnerContext(db: SupabaseClient, storeId: string) {
  const { data: store } = await db
    .from("stores")
    .select("name, slug, owner_id, phone, whatsapp")
    .eq("id", storeId)
    .maybeSingle();
  if (!store?.owner_id) return null;
  if (store.slug && SKIP_SLUGS.has(store.slug)) return null;

  const { data: userData } = await db.auth.admin.getUserById(store.owner_id);
  const email = userData.user?.email?.trim() || "";
  const meta = (userData.user?.user_metadata || {}) as Record<string, string>;
  return {
    store,
    email,
    name: String(meta.full_name || store.name || "").trim(),
    phone: String(store.whatsapp || store.phone || meta.phone || "").trim(),
    utm: [meta.utm_source, meta.utm_medium, meta.utm_campaign].filter(Boolean).join(" / "),
  };
}

/** Une fois : le commerçant a encaissé via le lien MoMo → Jacques relance le PRO. */
export async function notifyJacquesFirstBoutiqueSale(
  db: SupabaseClient,
  storeId: string,
  amount: number,
  productName: string
): Promise<void> {
  try {
    const { count } = await db
      .from("sale_payments")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId)
      .eq("status", "succeeded");
    if ((count ?? 0) !== 1) return;

    const ctx = await storeOwnerContext(db, storeId);
    if (!ctx) return;

    const fcfa = Number.isFinite(amount) ? Math.round(amount) : 0;
    const item = productName.replace(/[\r\n\t]+/g, " ").trim().slice(0, 80) || "Produit";

    await postMerchantAlert({
      name: ctx.name,
      email: ctx.email,
      whatsapp: ctx.phone,
      store: ctx.store.name,
      slug: ctx.store.slug || "",
      stage: "first_sale",
      utm: ctx.utm,
      note: `${item} — ${fcfa} FCFA`,
    });

    if (ctx.email) {
      const dashboard = "https://app.wazo-digital.com/dashboard";
      const text = [
        `Bonjour ${ctx.name || ""} !`.trim(),
        "",
        `Un client vient de payer ${item} — ${fcfa.toLocaleString("fr-FR")} FCFA via votre lien MoMo.`,
        "Vous n’avez rien à ouvrir : l’argent est enregistré.",
        "",
        `Voir la vente : ${dashboard}`,
        "",
        "Jacques — Wazo Digital",
      ].join("\n");
      await sendWeeklyReportEmail({
        to: ctx.email,
        storeName: ctx.store.name || "Wazo",
        subject: `${ctx.store.name || "Wazo"} — ${fcfa.toLocaleString("fr-FR")} FCFA reçus`,
        html: `<p>${text.replace(/\n/g, "<br/>")}</p>`,
        text,
      });
    }
  } catch (e) {
    console.error("[first-sale-alert]", e instanceof Error ? e.message : e);
  }
}

/** Une fois : 1er produit en ligne → Jacques dit d’envoyer le lien MoMo. */
export async function notifyJacquesFirstProduct(
  db: SupabaseClient,
  storeId: string,
  productName: string,
  productId: string,
  hasPhoto: boolean
): Promise<void> {
  try {
    const { count } = await db
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId);
    if ((count ?? 0) !== 1) return;

    const ctx = await storeOwnerContext(db, storeId);
    if (!ctx) return;

    const item = productName.replace(/[\r\n\t]+/g, " ").trim().slice(0, 80) || "Produit";
    await postMerchantAlert({
      name: ctx.name,
      email: ctx.email,
      whatsapp: ctx.phone,
      store: ctx.store.name,
      slug: ctx.store.slug || "",
      stage: "first_product",
      utm: ctx.utm,
      note: `${item}${hasPhoto ? "" : " — sans photo"}|${productId}`,
    });
  } catch (e) {
    console.error("[first-product-alert]", e instanceof Error ? e.message : e);
  }
}
