import { NextRequest, NextResponse } from "next/server";
import { checkStoreAccess, requireAuthContext } from "@/lib/api-auth";
import {
  buildMetaOAuthUrl,
  metaAppCredentials,
  signOAuthState,
} from "@/lib/merchant-meta";
import { createServiceSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** GET /api/social/meta/connect?storeId=... → redirect OAuth Facebook */
export async function GET(request: NextRequest) {
  const auth = await requireAuthContext();
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  if (!metaAppCredentials()) {
    return NextResponse.json(
      {
        success: false,
        error: "Publication Facebook non configurée (META_APP_ID / META_APP_SECRET).",
      },
      { status: 503 }
    );
  }

  const storeId = request.nextUrl.searchParams.get("storeId")?.trim();
  if (!storeId) {
    return NextResponse.json({ success: false, error: "storeId requis" }, { status: 400 });
  }

  const access = await checkStoreAccess(auth.serviceSupabase, auth.userId, storeId, "write");
  if (!access.ok) {
    return NextResponse.json(
      { success: false, error: access.error },
      { status: access.status || 403 }
    );
  }

  // Seul le propriétaire peut connecter les réseaux (pas employé)
  const service = await createServiceSupabase();
  const { data: store } = await service
    .from("stores")
    .select("id, owner_id")
    .eq("id", storeId)
    .maybeSingle();
  if (!store || store.owner_id !== auth.userId) {
    return NextResponse.json(
      { success: false, error: "Seul le propriétaire peut connecter Facebook." },
      { status: 403 }
    );
  }

  const state = signOAuthState(storeId, auth.userId);
  const url = buildMetaOAuthUrl(state);
  if (!url) {
    return NextResponse.json({ success: false, error: "OAuth indisponible" }, { status: 503 });
  }

  return NextResponse.redirect(url);
}
