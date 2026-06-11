import { NextResponse } from "next/server";
import { checkStoreAccess, getAdminSupabase, requireAuthContext } from "@/lib/api-auth";

export async function GET(request: Request) {
  const auth = await requireAuthContext();
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const storeId = searchParams.get("store_id");
  if (!storeId) {
    return NextResponse.json({ success: false, error: "store_id requis" }, { status: 400 });
  }

  const access = await checkStoreAccess(auth.serviceSupabase, auth.userId, storeId, "read");
  if (!access.ok) {
    return NextResponse.json({ success: false, error: access.error }, { status: access.status });
  }

  const admin = await getAdminSupabase();
  const { data, error } = await admin
    .from("store_report_settings")
    .select("*")
    .eq("store_id", storeId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, settings: data });
}

export async function PUT(request: Request) {
  const auth = await requireAuthContext();
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const body = (await request.json()) as {
    store_id?: string;
    email?: string;
    enabled?: boolean;
  };

  if (!body.store_id || !body.email?.trim()) {
    return NextResponse.json(
      { success: false, error: "store_id et email requis" },
      { status: 400 }
    );
  }

  const access = await checkStoreAccess(
    auth.serviceSupabase,
    auth.userId,
    body.store_id,
    "write"
  );
  if (!access.ok) {
    return NextResponse.json({ success: false, error: access.error }, { status: access.status });
  }

  const admin = await getAdminSupabase();
  const { data, error } = await admin
    .from("store_report_settings")
    .upsert({
      store_id: body.store_id,
      email: body.email.trim(),
      enabled: body.enabled !== false,
      weekday: 1,
      hour_utc: 8,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, settings: data });
}
