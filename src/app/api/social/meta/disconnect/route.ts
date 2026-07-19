import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/api-auth";
import { createServiceSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireAuthContext();
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const body = (await request.json().catch(() => ({}))) as { storeId?: string };
  const storeId = body.storeId?.trim();
  if (!storeId) {
    return NextResponse.json({ success: false, error: "storeId requis" }, { status: 400 });
  }

  const service = await createServiceSupabase();
  const { data: store } = await service
    .from("stores")
    .select("id, owner_id")
    .eq("id", storeId)
    .maybeSingle();

  if (!store || store.owner_id !== auth.userId) {
    return NextResponse.json({ success: false, error: "Accès refusé" }, { status: 403 });
  }

  const { error } = await service
    .from("store_social_accounts")
    .delete()
    .eq("store_id", storeId)
    .eq("platform", "facebook");

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
