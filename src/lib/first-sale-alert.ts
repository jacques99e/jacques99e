import type { SupabaseClient } from "@supabase/supabase-js";
import { PROD_LANDING_URL } from "@/lib/site-urls";

const SKIP_SLUGS = new Set(["hbk-boutyk-237"]);

function landingAlertUrl() {
  const base =
    process.env.NEXT_PUBLIC_LANDING_URL?.trim().replace(/\/$/, "") || PROD_LANDING_URL;
  return `${base}/api/signup-alert`;
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

    const { data: store } = await db
      .from("stores")
      .select("name, slug, owner_id, phone, whatsapp")
      .eq("id", storeId)
      .maybeSingle();
    if (!store?.owner_id) return;
    if (store.slug && SKIP_SLUGS.has(store.slug)) return;

    const { data: userData } = await db.auth.admin.getUserById(store.owner_id);
    const email = userData.user?.email?.trim() || "";
    const meta = (userData.user?.user_metadata || {}) as Record<string, string>;
    const name = String(meta.full_name || store.name || "").trim();
    const phone = String(store.whatsapp || store.phone || meta.phone || "").trim();
    const utm = [meta.utm_source, meta.utm_medium, meta.utm_campaign]
      .filter(Boolean)
      .join(" / ");
    const fcfa = Number.isFinite(amount) ? Math.round(amount) : 0;
    const item = productName.replace(/[\r\n\t]+/g, " ").trim().slice(0, 80) || "Produit";

    await fetch(landingAlertUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        whatsapp: phone,
        store: store.name,
        slug: store.slug || "",
        stage: "first_sale",
        utm,
        note: `${item} — ${fcfa} FCFA`,
      }),
    });
  } catch (e) {
    console.error("[first-sale-alert]", e instanceof Error ? e.message : e);
  }
}
