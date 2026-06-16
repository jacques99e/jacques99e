import { NextRequest, NextResponse } from "next/server";
import { checkStoreAccess, requireAuthContext } from "@/lib/api-auth";
import { toPublicProductImageUrl } from "@/lib/storage-public-url";
import { createServiceSupabase } from "@/lib/supabase/server";

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAuthContext();
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const body = (await request.json()) as {
      store_id?: string;
      name?: string;
      description?: string | null;
      phone?: string | null;
      whatsapp?: string | null;
      logo_url?: string | null;
      cover_url?: string | null;
    };

    const storeId = body.store_id?.trim();
    if (!storeId) {
      return NextResponse.json({ success: false, error: "Boutique introuvable." }, { status: 400 });
    }

    const access = await checkStoreAccess(auth.serviceSupabase, auth.userId, storeId, "write");
    if (!access.ok) {
      return NextResponse.json({ success: false, error: access.error }, { status: access.status });
    }

    const payload = {
      name: body.name?.trim() || "Ma boutique",
      description: body.description?.trim() || null,
      phone: body.phone?.trim() || null,
      whatsapp: body.whatsapp?.trim() || body.phone?.trim() || null,
      logo_url: body.logo_url?.trim() || null,
      cover_url: body.cover_url?.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const service = await createServiceSupabase();
    const { data, error } = await service
      .from("stores")
      .update(payload)
      .eq("id", storeId)
      .eq("owner_id", auth.userId)
      .select("*")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: error?.message || "Enregistrement impossible." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      store: {
        ...data,
        logo_url: toPublicProductImageUrl(data.logo_url),
        cover_url: toPublicProductImageUrl(data.cover_url),
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Impossible d'enregistrer la boutique." },
      { status: 500 }
    );
  }
}
