import { NextResponse } from "next/server";
import { checkStoreAccess, requireAuthContext } from "@/lib/api-auth";

export async function POST(request: Request) {
  const auth = await requireAuthContext();
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const body = (await request.json()) as {
    store_id?: string;
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };

  if (!body.store_id || !body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return NextResponse.json({ success: false, error: "Données invalides" }, { status: 400 });
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

  const { error } = await auth.serviceSupabase.from("push_subscriptions").upsert(
    {
      user_id: auth.userId,
      store_id: body.store_id,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      user_agent: request.headers.get("user-agent"),
    },
    { onConflict: "user_id,endpoint" }
  );

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const auth = await requireAuthContext();
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const endpoint = new URL(request.url).searchParams.get("endpoint");
  if (!endpoint) {
    return NextResponse.json({ success: false, error: "endpoint requis" }, { status: 400 });
  }

  await auth.serviceSupabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", auth.userId)
    .eq("endpoint", endpoint);

  return NextResponse.json({ success: true });
}
