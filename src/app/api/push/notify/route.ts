import { NextResponse } from "next/server";
import { checkStoreAccess, requireAuthContext } from "@/lib/api-auth";
import { isPushConfigured, sendWebPush } from "@/lib/push-server";

export async function POST(request: Request) {
  const auth = await requireAuthContext();
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  if (!isPushConfigured()) {
    return NextResponse.json(
      { success: false, error: "Notifications push non configurées (VAPID)" },
      { status: 503 }
    );
  }

  const body = (await request.json()) as {
    store_id?: string;
    title?: string;
    message?: string;
    url?: string;
  };

  if (!body.store_id || !body.title) {
    return NextResponse.json({ success: false, error: "Paramètres invalides" }, { status: 400 });
  }

  const access = await checkStoreAccess(
    auth.serviceSupabase,
    auth.userId,
    body.store_id,
    "read"
  );
  if (!access.ok) {
    return NextResponse.json({ success: false, error: access.error }, { status: access.status });
  }

  const { data: subs } = await auth.serviceSupabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", auth.userId)
    .eq("store_id", body.store_id);

  let sent = 0;
  for (const sub of subs || []) {
    try {
      await sendWebPush(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        {
          title: body.title,
          body: body.message || "",
          url: body.url || "/dashboard",
        }
      );
      sent++;
    } catch {
      // expired subscription — ignore
    }
  }

  return NextResponse.json({ success: true, sent });
}
