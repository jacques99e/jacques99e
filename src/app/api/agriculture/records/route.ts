import { NextRequest, NextResponse } from "next/server";
import { checkStoreAccess, requireAuthContext } from "@/lib/api-auth";
import { isCloudUuid } from "@/lib/cloud-uuid";
import { createServiceSupabase } from "@/lib/supabase/server";

const INPUT_TYPES = new Set(["engrais", "pesticides", "eau"]);

export async function GET(request: NextRequest) {
  const auth = await requireAuthContext();
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }
  const storeId = request.nextUrl.searchParams.get("storeId")?.trim() || "";
  const kind = request.nextUrl.searchParams.get("kind")?.trim() || "";
  if (!isCloudUuid(storeId) || (kind !== "input" && kind !== "yield")) {
    return NextResponse.json({ success: false, error: "Paramètres invalides." }, { status: 400 });
  }
  const access = await checkStoreAccess(auth.serviceSupabase, auth.userId, storeId, "read");
  if (!access.ok) {
    return NextResponse.json({ success: false, error: access.error }, { status: access.status });
  }

  const service = await createServiceSupabase();
  if (kind === "yield") {
    const { data, error } = await service
      .from("farm_records")
      .select("id, payload, created_at")
      .eq("store_id", storeId)
      .eq("record_type", "yield")
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, records: data || [] });
  }

  const { data: parcels } = await service.from("farm_parcels").select("id, name").eq("store_id", storeId);
  const ids = (parcels || []).map((p) => p.id as string);
  const names = new Map((parcels || []).map((p) => [p.id as string, p.name as string]));
  if (!ids.length) return NextResponse.json({ success: true, records: [] });
  const { data, error } = await service
    .from("farm_inputs")
    .select("id, parcel_id, input_type, quantity, notes, applied_at")
    .in("parcel_id", ids)
    .order("applied_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({
    success: true,
    records: (data || []).map((row) => ({
      ...row,
      plot_name: names.get(row.parcel_id as string) || "Parcelle",
    })),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthContext();
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }
  const body = (await request.json().catch(() => ({}))) as {
    store_id?: string;
    kind?: string;
    parcel_id?: string;
    input_type?: string;
    name?: string;
    quantity?: number;
    date?: string;
    harvest_kg?: number;
    area_ha?: number;
    result?: number;
  };
  const storeId = body.store_id?.trim() || "";
  if (!isCloudUuid(storeId)) {
    return NextResponse.json({ success: false, error: "Boutique invalide." }, { status: 400 });
  }
  const access = await checkStoreAccess(auth.serviceSupabase, auth.userId, storeId, "write");
  if (!access.ok) {
    return NextResponse.json({ success: false, error: access.error }, { status: access.status });
  }
  const service = await createServiceSupabase();

  if (body.kind === "input") {
    const parcelId = body.parcel_id?.trim() || "";
    const inputType = body.input_type?.trim() || "";
    const name = body.name?.trim().slice(0, 80) || "";
    const quantity = Number(body.quantity);
    if (!isCloudUuid(parcelId) || !INPUT_TYPES.has(inputType) || !name || !Number.isFinite(quantity)) {
      return NextResponse.json({ success: false, error: "Intrant incomplet." }, { status: 400 });
    }
    const { data: parcel } = await service
      .from("farm_parcels")
      .select("id, name")
      .eq("id", parcelId)
      .eq("store_id", storeId)
      .maybeSingle();
    if (!parcel) {
      return NextResponse.json({ success: false, error: "Parcelle introuvable." }, { status: 404 });
    }
    const { data, error } = await service
      .from("farm_inputs")
      .insert({
        parcel_id: parcelId,
        input_type: inputType,
        quantity,
        unit: "kg",
        applied_at: body.date || new Date().toISOString().slice(0, 10),
        notes: name,
      })
      .select("id, parcel_id, input_type, quantity, notes, applied_at")
      .single();
    if (error || !data) {
      return NextResponse.json({ success: false, error: error?.message || "Enregistrement impossible." }, { status: 500 });
    }
    return NextResponse.json({ success: true, record: { ...data, plot_name: parcel.name } });
  }

  if (body.kind === "yield") {
    const harvest = Number(body.harvest_kg);
    const area = Number(body.area_ha);
    const result = Number(body.result);
    if (!(harvest > 0) || !(area > 0) || !(result > 0)) {
      return NextResponse.json({ success: false, error: "Rendement invalide." }, { status: 400 });
    }
    const { data, error } = await service
      .from("farm_records")
      .insert({
        store_id: storeId,
        record_type: "yield",
        notes: `${result} kg/ha`,
        payload: { harvest_kg: harvest, area_ha: area, result },
      })
      .select("id, payload, created_at")
      .single();
    if (error || !data) {
      return NextResponse.json({ success: false, error: error?.message || "Enregistrement impossible." }, { status: 500 });
    }
    return NextResponse.json({ success: true, record: data });
  }

  return NextResponse.json({ success: false, error: "Type inconnu." }, { status: 400 });
}
