import { getTrialDaysLeft, type BillingSubscription } from "@/lib/billing";
import { sendWeeklyReportEmail } from "@/lib/email";
import type { SupabaseClient } from "@supabase/supabase-js";

const SKIP_SLUGS = new Set(["hbk-boutyk-237"]);
const JACQUES = "jacquesnoussougan93@gmail.com";
const PRO_PAY = "https://app.wazo-digital.com/billing?plan=pro&pay=1";
const ADD_PRODUCT = "https://app.wazo-digital.com/products/add";

function waDigits(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 8) digits = `228${digits}`;
  return digits;
}

function waCloseLink(phone: string, text: string): string | null {
  const digits = waDigits(phone);
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

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
    if (days !== 2 && days !== 0 && days !== 11) continue;

    const { data: store } = await db
      .from("stores")
      .select("name, slug, owner_id, phone, whatsapp")
      .eq("id", sub.store_id)
      .maybeSingle();
    if (!store?.owner_id) continue;
    if (store.slug && SKIP_SLUGS.has(store.slug)) continue;

    const { data: userData } = await db.auth.admin.getUserById(store.owner_id);
    const { data: profile } = await db
      .from("profiles")
      .select("phone")
      .eq("id", store.owner_id)
      .maybeSingle();

    const to = userData.user?.email?.trim() || "";
    const phone = String(
      store.whatsapp || store.phone || profile?.phone || userData.user?.phone || ""
    ).trim();
    const name = store.name || "votre boutique";
    const person =
      String(userData.user?.user_metadata?.full_name || "").trim() || name;

    if (days === 11) {
      const { count } = await db
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("store_id", sub.store_id);
      if ((count ?? 0) > 0) continue;
      const silentText = [
        `Bonjour ${person} !`,
        "",
        `Votre boutique ${name} est ouverte. Ajoutez 1 produit, puis envoyez le lien MoMo.`,
        ADD_PRODUCT,
        "",
        "Jacques — Wazo Digital",
      ].join("\n");
      const wa = waCloseLink(phone, silentText);
      digest.push(
        [
          `${name} (${store.slug || sub.store_id}) — J+3 silencieux, 0 produit`,
          to || "pas d’email",
          wa || "pas de WhatsApp",
        ].join(" — ")
      );
      continue;
    }

    const text =
      days === 0
        ? `L'essai de ${name} est terminé. Pour garder caisse, stock et lien MoMo : ${PRO_PAY}\n\nJacques — Wazo Digital`
        : `Plus que 2 jours d'essai sur ${name}. 1 produit + 1 vente MoMo, puis PRO à 9,99 €/mois : ${PRO_PAY}\n\nJacques — Wazo Digital`;
    const subject =
      days === 0
        ? `${name} — l'essai Wazo est terminé`
        : `${name} — encore 2 jours d'essai Wazo`;

    if (to) {
      const result = await sendWeeklyReportEmail({
        to,
        storeName: name,
        subject,
        html: `<p>${text.replace(/\n/g, "<br/>")}</p>`,
        text,
      });
      if (result.ok) sent += 1;
    }

    const wa = waCloseLink(phone, text);
    digest.push(
      [
        `${name} (${store.slug || sub.store_id}) — J-${days}`,
        to || "pas d’email",
        wa || "pas de WhatsApp",
      ].join(" — ")
    );
  }

  if (digest.length) {
    await sendWeeklyReportEmail({
      to: JACQUES,
      storeName: "Wazo",
      subject: `Essais à relancer (${digest.length})`,
      html: `<p>${digest.map((line) => line.replace(/https?:\/\/\S+/g, '<a href="$&">$&</a>')).join("<br/>")}</p>`,
      text: digest.join("\n"),
    });
  }

  return sent;
}
