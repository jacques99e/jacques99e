import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/api-auth";
import { normalizeModuleIds } from "@/lib/modules/config";

/**
 * PUT /api/stores/modules
 * Persiste les modules actifs (store_modules + stores.modules + profiles.active_modules).
 * Body: { storeId: string, modules?: string[], syncFromProfile?: boolean }
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuthContext();
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const body = (await request.json()) as {
      storeId?: string;
      modules?: string[];
      syncFromProfile?: boolean;
    };

    const storeId = body.storeId?.trim();
    if (!storeId) {
      return NextResponse.json({ success: false, error: "storeId requis." }, { status: 400 });
    }

    const { data: store, error: storeError } = await auth.serviceSupabase
      .from("stores")
      .select("id, owner_id, modules")
      .eq("id", storeId)
      .eq("owner_id", auth.userId)
      .maybeSingle();

    if (storeError || !store) {
      return NextResponse.json(
        { success: false, error: "Boutique introuvable." },
        { status: 404 }
      );
    }

    const { data: profile } = await auth.serviceSupabase
      .from("profiles")
      .select("active_modules")
      .eq("id", auth.userId)
      .maybeSingle();

    const { data: existingRows } = await auth.serviceSupabase
      .from("store_modules")
      .select("module_id")
      .eq("store_id", storeId)
      .eq("enabled", true);

    const fromStore = (existingRows || []).map((r) => String(r.module_id));
    const fromProfile = Array.isArray(profile?.active_modules)
      ? (profile!.active_modules as string[])
      : [];
    const fromBody = Array.isArray(body.modules) ? body.modules : [];

    let modules = normalizeModuleIds(
      body.syncFromProfile || !fromBody.length
        ? [...fromStore, ...fromProfile, ...fromBody]
        : fromBody
    );

    if (!modules.length) modules = ["commerce"];

    await auth.serviceSupabase.from("store_modules").delete().eq("store_id", storeId);
    const { error: insertError } = await auth.serviceSupabase.from("store_modules").insert(
      modules.map((module_id) => ({
        store_id: storeId,
        module_id,
        enabled: true,
      }))
    );
    if (insertError) {
      return NextResponse.json(
        { success: false, error: insertError.message },
        { status: 500 }
      );
    }

    await auth.serviceSupabase
      .from("stores")
      .update({ modules })
      .eq("id", storeId);

    await auth.serviceSupabase
      .from("profiles")
      .update({ active_modules: modules })
      .eq("id", auth.userId);

    return NextResponse.json({
      success: true,
      modules,
      reconciled: {
        beforeStore: fromStore,
        beforeProfile: fromProfile,
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Impossible d'enregistrer les modules." },
      { status: 500 }
    );
  }
}
