import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/api-auth";
import { normalizeModuleIds, parseModuleIds } from "@/lib/modules/config";
import { persistStoreModules } from "@/lib/store-modules";
import { createServiceSupabase } from "@/lib/supabase/server";

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

    const fromStore = parseModuleIds((existingRows || []).map((r) => String(r.module_id)));
    const fromProfile = parseModuleIds(
      Array.isArray(profile?.active_modules) ? (profile.active_modules as string[]) : []
    );
    const fromColumn = parseModuleIds(Array.isArray(store.modules) ? (store.modules as string[]) : []);
    const fromBody = parseModuleIds(Array.isArray(body.modules) ? body.modules : []);

    const modules = fromBody.length
      ? fromBody
      : normalizeModuleIds([...fromStore, ...fromColumn, ...fromProfile]);

    const db = await createServiceSupabase();
    const saved = await persistStoreModules(db, storeId, auth.userId, modules);
    if ("error" in saved) {
      return NextResponse.json({ success: false, error: saved.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      modules: saved.modules,
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
