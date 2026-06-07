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
