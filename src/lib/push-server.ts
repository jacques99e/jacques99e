const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || "mailto:support@wazo-digital.app";

export function isPushConfigured(): boolean {
  return Boolean(vapidPublic && vapidPrivate);
}

async function getWebPush() {
  try {
    const mod = await import("web-push");
    return mod.default ?? mod;
  } catch {
    return null;
  }
}

export async function sendWebPush(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: { title: string; body: string; url?: string }
): Promise<void> {
  if (!isPushConfigured()) {
    throw new Error("VAPID keys not configured");
  }
  const webpush = await getWebPush();
  if (!webpush) {
    throw new Error("Install web-push package for server push");
  }
  webpush.setVapidDetails(vapidSubject, vapidPublic!, vapidPrivate!);
  await webpush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: subscription.keys,
    },
    JSON.stringify(payload)
  );
}

/** Envoie une notif push à tous les abonnés d'une boutique. */
export async function notifyStoreSubscribers(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: { from: (t: string) => any },
  storeId: string,
  payload: { title: string; body: string; url?: string }
): Promise<number> {
  if (!isPushConfigured()) return 0;
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("store_id", storeId);

  let sent = 0;
  for (const sub of subs || []) {
    try {
      await sendWebPush(
        {
          endpoint: sub.endpoint as string,
          keys: {
            p256dh: sub.p256dh as string,
            auth: sub.auth as string,
          },
        },
        payload
      );
      sent += 1;
    } catch {
      /* expired */
    }
  }
  return sent;
}
