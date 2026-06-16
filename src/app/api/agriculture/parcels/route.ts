import { NextRequest, NextResponse } from "next/server";
import { checkStoreAccess, requireAuthContext } from "@/lib/api-auth";
import { createServiceSupabase } from "@/lib/supabase/server";
import type { FarmParcel, FarmStage } from "@/types";

const STAGES: FarmStage[] = ["growth", "flowering", "harvest", "fallow"];

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthContext();
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const body = (await request.json()) as Partial<FarmParcel> & {
      store_id?: string;
      name?: string;
      area_hectares?: number;
      crop_type?: string;
    };

    const storeId = body.store_id?.trim();
    if (!storeId) {
      return NextResponse.json({ success: false, error: "Boutique introuvable." }, { status: 400 });
    }

    const access = await checkStoreAccess(auth.serviceSupabase, auth.userId, storeId, "write");
    if (!access.ok) {
      return NextResponse.json({ success: false, error: access.error }, { status: access.status });
    }

    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ success: false, error: "Nom de parcelle requis." }, { status: 400 });
    }

    const area = Number(body.area_hectares);
    const crop_type = body.crop_type?.trim();
    if (!Number.isFinite(area) || area <= 0 || !crop_type) {
      return NextResponse.json({ success: false, error: "Surface et culture requises." }, { status: 400 });
    }

    const stage = STAGES.includes(body.stage as FarmStage) ? (body.stage as FarmStage) : "growth";

    const service = await createServiceSupabase();
    const { data, error } = await service
      .from("farm_parcels")
      .insert({
        store_id: storeId,
        name,
        area_hectares: area,
        crop_type,
        sowing_date: body.sowing_date ?? null,
        stage,
        expected_yield_kg: body.expected_yield_kg ?? null,
        harvested_kg: body.harvested_kg ?? 0,
        latitude: body.latitude ?? null,
        longitude: body.longitude ?? null,
      })
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: error?.message || "Enregistrement impossible." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, parcel: data });
  } catch {
    return NextResponse.json(
      { success: false, error: "Impossible d'enregistrer la parcelle." },
      { status: 500 }
    );
  }
}
