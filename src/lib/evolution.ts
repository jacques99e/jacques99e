import type { SupabaseClient } from "@supabase/supabase-js";
import { formatCurrency } from "@/lib/utils";
import {
  getTrialDaysLeft,
  normalizeBillingStatus,
  type BillingSubscription,
} from "@/lib/billing";

const SKIP_PRO_SLUGS = new Set(["hbk-boutyk-237"]);

export interface EvolutionSnapshot {
  storeId: string;
  storeName: string;
  slug: string | null;
  ownerId: string | null;
  products: number;
  salesWeek: number;
  revenueWeek: number;
  salesTotal: number;
  momoSales: number;
  firstProductAt: string | null;
  firstSaleAt: string | null;
  trialDaysLeft: number | null;
  billingStatus: string;
  skipProCopy: boolean;
}

export interface EvolutionNotice {
  kind: "weekly" | "milestone" | "progress";
  dedup_key: string;
  title: string;
  body: string;
  href: string;
  emailIfFresh: boolean;
}

export function isoWeekKey(date = new Date()): string {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function hoursSince(iso: string | null): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  return (Date.now() - new Date(iso).getTime()) / 36e5;
}

export async function loadEvolutionSnapshot(
  db: SupabaseClient,
  storeId: string
): Promise<EvolutionSnapshot | null> {
  const { data: store } = await db
    .from("stores")
    .select("id, name, slug, owner_id")
    .eq("id", storeId)
    .maybeSingle();
  if (!store) return null;

  const weekStart = new Date();
  weekStart.setUTCDate(weekStart.getUTCDate() - 7);
  weekStart.setUTCHours(0, 0, 0, 0);

  const [
    productsRes,
    salesWeekRes,
    salesTotalRes,
    momoRes,
    billingRes,
  ] = await Promise.all([
    db
      .from("products")
      .select("id, created_at", { count: "exact" })
      .eq("store_id", storeId)
      .order("created_at", { ascending: true })
      .limit(1),
    db
      .from("sales")
      .select("total_amount, total, created_at")
      .eq("store_id", storeId)
      .gte("created_at", weekStart.toISOString()),
    db
      .from("sales")
      .select("id, created_at", { count: "exact" })
      .eq("store_id", storeId)
      .order("created_at", { ascending: true })
      .limit(1),
    db
      .from("sale_payments")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId)
      .eq("status", "succeeded"),
    db
      .from("billing_subscriptions")
      .select("store_id, plan, status, trial_start, trial_days, current_period_end")
      .eq("store_id", storeId)
      .maybeSingle(),
  ]);

  const billing = billingRes.data as BillingSubscription | null;
  const status = billing ? normalizeBillingStatus(billing) : "trial";
  const trialDaysLeft =
    billing && status === "trial" ? getTrialDaysLeft(billing) : null;

  const weekSales = salesWeekRes.data || [];
  const revenueWeek = weekSales.reduce(
    (sum, row) => sum + Number(row.total_amount ?? row.total ?? 0),
    0
  );

  return {
    storeId,
    storeName: store.name || "votre boutique",
    slug: store.slug ?? null,
    ownerId: store.owner_id ?? null,
    products: productsRes.count ?? 0,
    salesWeek: weekSales.length,
    revenueWeek,
    salesTotal: salesTotalRes.count ?? 0,
    momoSales: momoRes.count ?? 0,
    firstProductAt: productsRes.data?.[0]?.created_at ?? null,
    firstSaleAt: salesTotalRes.data?.[0]?.created_at ?? null,
    trialDaysLeft,
    billingStatus: status,
    skipProCopy: Boolean(store.slug && SKIP_PRO_SLUGS.has(store.slug)),
  };
}

export function buildEvolutionNotices(snap: EvolutionSnapshot): EvolutionNotice[] {
  const week = isoWeekKey();
  const notices: EvolutionNotice[] = [];
  const payHint = snap.slug
    ? "Envoyez le lien MoMo à 3 clients."
    : "Ouvrez Produits, puis Envoyer le lien MoMo.";

  notices.push({
    kind: "weekly",
    dedup_key: `weekly:${week}`,
    title: "Votre semaine Wazo",
    body:
      snap.salesWeek > 0
        ? `${snap.salesWeek} vente(s) · ${formatCurrency(snap.revenueWeek)}. ${snap.products} produit(s) en ligne.`
        : snap.products > 0
          ? `${snap.products} produit(s) en ligne. ${payHint}`
          : "Ajoutez votre premier produit pour ouvrir la caisse.",
    href: snap.products > 0 ? "/products" : "/products/add",
    emailIfFresh: true,
  });

  if (snap.products >= 1) {
    notices.push({
      kind: "milestone",
      dedup_key: "milestone:first_product",
      title: "Premier produit en ligne",
      body: `${snap.storeName} a son premier produit. ${payHint}`,
      href: "/products",
      emailIfFresh: hoursSince(snap.firstProductAt) <= 48,
    });
  }

  if (snap.salesTotal >= 1 || snap.momoSales >= 1) {
    notices.push({
      kind: "milestone",
      dedup_key: "milestone:first_sale",
      title: "Première vente enregistrée",
      body: "Bravo — la caisse tourne. Continuez à envoyer le lien de paiement.",
      href: "/sales/history",
      emailIfFresh: hoursSince(snap.firstSaleAt) <= 48,
    });
  }

  if (snap.salesTotal >= 5) {
    notices.push({
      kind: "milestone",
      dedup_key: "milestone:sales_5",
      title: "5 ventes atteintes",
      body: `${snap.salesTotal} ventes au total. Gardez le rythme cette semaine.`,
      href: "/insights",
      emailIfFresh: false,
    });
  }

  if (snap.trialDaysLeft !== null) {
    notices.push({
      kind: "progress",
      dedup_key: `trial:${snap.trialDaysLeft <= 2 ? "ending" : "active"}:${week}`,
      title:
        snap.trialDaysLeft <= 2
          ? "Essai bientôt terminé"
          : `Encore ${snap.trialDaysLeft} jour(s) d'essai`,
      body: snap.skipProCopy
        ? `${snap.products} produit(s), ${snap.salesWeek} vente(s) cette semaine.`
        : snap.trialDaysLeft <= 2
          ? "Gardez caisse, stock et lien MoMo : ouvrez Facturation."
          : `${snap.products} produit(s), ${snap.salesWeek} vente(s) cette semaine.`,
      href: snap.skipProCopy || snap.trialDaysLeft > 2 ? "/dashboard" : "/billing?plan=pro&pay=1",
      emailIfFresh: snap.trialDaysLeft <= 2,
    });
  }

  return notices;
}

export function buildEvolutionEmail(params: {
  storeName: string;
  person: string;
  notices: Array<Pick<EvolutionNotice, "title" | "body">>;
}): { subject: string; html: string; text: string } {
  const { storeName, person, notices } = params;
  const lines = notices.map((n) => `• ${n.title} — ${n.body}`);
  const subject = `${storeName} — votre évolution Wazo`;
  const text = [
    `Bonjour ${person},`,
    "",
    `Voici où en est ${storeName} :`,
    "",
    ...lines,
    "",
    "Ouvrez l'app : https://app.wazo-digital.com/notifications",
    "",
    "Jacques — Wazo Digital",
  ].join("\n");

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
      <h2 style="color:#075E54;margin-bottom:8px">Votre évolution Wazo</h2>
      <p>Bonjour ${person},</p>
      <p>Voici où en est <strong>${storeName}</strong> :</p>
      <ul style="padding-left:18px">
        ${notices
          .map(
            (n) =>
              `<li style="margin:8px 0"><strong>${n.title}</strong><br/><span style="color:#444">${n.body}</span></li>`
          )
          .join("")}
      </ul>
      <p><a href="https://app.wazo-digital.com/notifications" style="color:#075E54">Voir dans l'app</a></p>
      <p style="color:#888;font-size:12px">Jacques — Wazo Digital</p>
    </div>
  `;

  return { subject, html, text };
}
