import { NextRequest, NextResponse } from "next/server";
import { checkStoreAccess, requireAuthContext } from "@/lib/api-auth";
import {
  listStoreNotifications,
  markNotificationsRead,
} from "@/lib/evolution-notify";
import { createServiceSupabase } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const auth = await requireAuthContext();
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const storeId = request.nextUrl.searchParams.get("store_id")?.trim();
  if (!storeId) {
    return NextResponse.json({ success: false, error: "store_id requis." }, { status: 400 });
  }

  const access = await checkStoreAccess(auth.serviceSupabase, auth.userId, storeId, "read");
  if (!access.ok) {
    return NextResponse.json({ success: false, error: access.error }, { status: access.status });
  }

  const unreadOnly = request.nextUrl.searchParams.get("unread") === "1";
  const service = await createServiceSupabase();
  const notifications = await listStoreNotifications(service, storeId, unreadOnly);
  return NextResponse.json({
    success: true,
    notifications,
    unread: notifications.filter((n) => !n.read_at).length,
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAuthContext();
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const body = (await request.json()) as { store_id?: string; ids?: string[] };
  const storeId = body.store_id?.trim();
  if (!storeId) {
    return NextResponse.json({ success: false, error: "store_id requis." }, { status: 400 });
  }

  const access = await checkStoreAccess(auth.serviceSupabase, auth.userId, storeId, "write");
  if (!access.ok) {
    return NextResponse.json({ success: false, error: access.error }, { status: access.status });
  }

  const service = await createServiceSupabase();
  await markNotificationsRead(service, storeId, body.ids);
  return NextResponse.json({ success: true });
}
