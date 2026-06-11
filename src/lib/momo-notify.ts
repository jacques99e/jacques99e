import type { SupabaseClient } from "@supabase/supabase-js";
import { sendTransactionEmail } from "@/lib/email";
import { isPushConfigured, sendWebPush } from "@/lib/push-server";

export interface MomoPaymentNotifyParams {
  storeId: string;
  amountFcfa: number;
  label: string;
  reference: string;
  customerPhone?: string | null;
}

export async function notifyStoreOnMomoPayment(
  supabase: SupabaseClient,
  params: MomoPaymentNotifyParams
): Promise<{ pushSent: number; emailSent: boolean }> {
  const { storeId, amountFcfa, label, reference, customerPhone } = params;
  const amountLabel = `${amountFcfa.toLocaleString("fr-FR")} FCFA`;
  const title = "Paiement MoMo reçu";
  const body = `${amountLabel} — ${label} (réf. ${reference})`;

  let pushSent = 0;
  if (isPushConfigured()) {
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("store_id", storeId);

    for (const sub of subs ?? []) {
      try {
        await sendWebPush(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          { title, body, url: "/sales/liens" }
        );
        pushSent++;
      } catch {
        /* subscription expired */
      }
    }
  }

  let emailSent = false;
  const { data: store } = await supabase
    .from("stores")
    .select("name, owner_id")
    .eq("id", storeId)
    .maybeSingle();

  if (store?.owner_id) {
    const { data: authUser } = await supabase.auth.admin.getUserById(store.owner_id);
    const email = authUser?.user?.email;
    if (email) {
      const result = await sendTransactionEmail({
        to: email,
        storeName: store.name || "Votre boutique",
        subject: `Paiement reçu — ${amountLabel}`,
        amountFcfa,
        label,
        reference,
        customerPhone,
      });
      emailSent = result.ok;
    }
  }

  return { pushSent, emailSent };
}
