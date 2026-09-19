import { NextRequest, NextResponse } from "next/server";
import { checkStoreAccess, requireAuthContext } from "@/lib/api-auth";
import { createServiceSupabase } from "@/lib/supabase/server";

export async function PUT(request: NextRequest) {
  const auth = await requireAuthContext();
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const body = (await request.json()) as { store_id?: string; email?: string };
  const storeId = body.store_id?.trim();
  const email = body.email?.trim().slice(0, 180) || "";
  if (!storeId || !email) {
    return NextResponse.json(
      { success: false, error: "store_id et email requis." },
      { status: 400 }
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ success: false, error: "Email invalide." }, { status: 400 });
  }

  const access = await checkStoreAccess(auth.serviceSupabase, auth.userId, storeId, "write");
  if (!access.ok) {
    return NextResponse.json({ success: false, error: access.error }, { status: access.status });
  }

  const service = await createServiceSupabase();
  const { data: existing } = await service
    .from("store_report_settings")
    .select("store_id")
    .eq("store_id", storeId)
    .maybeSingle();

  const { error } = existing
    ? await service
        .from("store_report_settings")
        .update({ email, updated_at: new Date().toISOString() })
        .eq("store_id", storeId)
    : await service.from("store_report_settings").insert({
        store_id: storeId,
        email,
        enabled: false,
        weekday: 1,
        hour_utc: 8,
        updated_at: new Date().toISOString(),
      });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, email });
}
