import { getTrialDaysLeft, type BillingSubscription } from "@/lib/billing";
import { sendWeeklyReportEmail } from "@/lib/email";
import type { SupabaseClient } from "@supabase/supabase-js";

const SKIP_SLUGS = new Set(["hbk-boutyk-237"]);
const JACQUES = "jacquesnoussougan93@gmail.com";

export async function nudgeEndingTrials(db: SupabaseClient): Promise<number> {
  const { data: subs } = await db
    .from("billing_subscriptions")
    .select("store_id,plan,status,trial_start,trial_days")
    .eq("status", "trial")
    .limit(80);

  let sent = 0;
  const digest: string[] = [];

  for (const row of subs || []) {
    const sub = row as BillingSubscription;
    const days = getTrialDaysLeft(sub);
    if (days !== 2 && days !== 0) continue;

    const { data: store } = await db
      .from("stores")
      .select("name, slug, owner_id")
      .eq("id", sub.store_id)
      .maybeSingle();
    if (!store?.owner_id) continue;
    if (store.slug && SKIP_SLUGS.has(store.slug)) continue;

    const { data: userData } = await db.auth.admin.getUserById(store.owner_id);
    const to = userData.user?.email?.trim();
    if (!to) continue;

    const name = store.name || "votre boutique";
    const pay = "https://app.wazo-digital.com/billing?plan=pro&pay=1";
    const subject =
      days === 0
        ? `${name} — l'essai Wazo est terminé`
        : `${name} — encore 2 jours d'essai Wazo`;
    const text =
      days === 0
        ? `L'essai de ${name} est terminé. Pour garder caisse, stock et lien MoMo : ${pay}\n\nJacques — Wazo Digital`
        : `Plus que 2 jours d'essai sur ${name}. 1 produit + 1 vente MoMo, puis PRO à 9,99 €/mois : ${pay}\n\nJacques — Wazo Digital`;

    const result = await sendWeeklyReportEmail({
      to,
      storeName: name,
      subject,
      html: `<p>${text.replace(/\n/g, "<br/>")}</p>`,
      text,
    });
    if (result.ok) {
      sent += 1;
      digest.push(`${name} (${store.slug || sub.store_id}) — J-${days} — ${to}`);
    }
  }

  if (digest.length) {
    await sendWeeklyReportEmail({
      to: JACQUES,
      storeName: "Wazo",
      subject: `Essais PRO à relancer (${digest.length})`,
      html: `<p>${digest.join("<br/>")}</p>`,
      text: digest.join("\n"),
    });
  }

  return sent;
}
