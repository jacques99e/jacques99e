import { NextRequest, NextResponse } from "next/server";
import {
  appPublicUrl,
  exchangeCodeForUserToken,
  exchangeLongLivedUserToken,
  listManagedPages,
  verifyOAuthState,
} from "@/lib/merchant-meta";
import { createServiceSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const base = appPublicUrl();
  const settingsUrl = `${base}/settings/business`;

  const err =
    request.nextUrl.searchParams.get("error_description") ||
    request.nextUrl.searchParams.get("error");
  if (err) {
    return NextResponse.redirect(
      `${settingsUrl}?social=error&msg=${encodeURIComponent(err)}`
    );
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  if (!code || !state) {
    return NextResponse.redirect(
      `${settingsUrl}?social=error&msg=${encodeURIComponent("Callback Meta incomplet")}`
    );
  }

  const parsed = verifyOAuthState(state);
  if (!parsed) {
    return NextResponse.redirect(
      `${settingsUrl}?social=error&msg=${encodeURIComponent("Session OAuth expirée")}`
    );
  }

  try {
    const short = await exchangeCodeForUserToken(code);
    const longLived = await exchangeLongLivedUserToken(short.access_token!);
    const pages = await listManagedPages(longLived.access_token!);
    if (!pages.length) {
      return NextResponse.redirect(
        `${settingsUrl}?social=error&msg=${encodeURIComponent(
          "Aucune Page Facebook trouvée. Créez une Page ou devenez admin."
        )}`
      );
    }

    // Première Page (MVP). Plus tard : écran de choix.
    const page = pages[0];
    const igId = page.instagram_business_account?.id || null;
    const expiresAt = longLived.expires_in
      ? new Date(Date.now() + longLived.expires_in * 1000).toISOString()
      : null;

    const service = await createServiceSupabase();
    const { error } = await service.from("store_social_accounts").upsert(
      {
        store_id: parsed.storeId,
        platform: "facebook",
        page_id: page.id,
        page_name: page.name,
        page_access_token: page.access_token,
        ig_user_id: igId,
        token_expires_at: expiresAt,
        connected_by: parsed.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "store_id,platform" }
    );

    if (error) {
      return NextResponse.redirect(
        `${settingsUrl}?social=error&msg=${encodeURIComponent(error.message)}`
      );
    }

    return NextResponse.redirect(
      `${settingsUrl}?social=ok&page=${encodeURIComponent(page.name)}`
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Connexion Meta échouée";
    return NextResponse.redirect(
      `${settingsUrl}?social=error&msg=${encodeURIComponent(message)}`
    );
  }
}
