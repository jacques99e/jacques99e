import { NextRequest, NextResponse } from "next/server";
import { checkStoreAccess, requireAuthContext } from "@/lib/api-auth";
import { metaAppCredentials } from "@/lib/merchant-meta";
import { createServiceSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Statut connexion (sans exposer le token). */
export async function GET(request: NextRequest) {
  const auth = await requireAuthContext();
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const storeId = request.nextUrl.searchParams.get("storeId")?.trim();
  if (!storeId) {
    return NextResponse.json({ success: false, error: "storeId requis" }, { status: 400 });
  }

  const access = await checkStoreAccess(auth.serviceSupabase, auth.userId, storeId, "read");
  if (!access.ok) {
    return NextResponse.json(
      { success: false, error: access.error },
      { status: access.status || 403 }
    );
  }

  const service = await createServiceSupabase();
  const { data } = await service
    .from("store_social_accounts")
    .select("page_id, page_name, ig_user_id, ig_username, updated_at")
    .eq("store_id", storeId)
    .eq("platform", "facebook")
    .maybeSingle();

  return NextResponse.json({
    success: true,
    configured: Boolean(metaAppCredentials()),
    connected: Boolean(data?.page_id),
    pageName: data?.page_name || null,
    pageId: data?.page_id || null,
    instagram: Boolean(data?.ig_user_id),
    igUsername: data?.ig_username || null,
    updatedAt: data?.updated_at || null,
  });
}
