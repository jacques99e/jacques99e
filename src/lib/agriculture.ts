import tipsData from "@/data/agriculture-tips.json";
import { db } from "@/lib/db";
import { supabase } from "@/lib/supabase/client";
import { generateLocalId } from "@/lib/sync";
import type { FarmParcel, FarmStage } from "@/types";

export async function listParcels(storeId: string): Promise<FarmParcel[]> {
  if (db) {
    const local = await db.farmParcels.where("store_id").equals(storeId).toArray();
    if (local.length || !navigator.onLine) return local;
  }
  if (!navigator.onLine) return [];
  const { data } = await supabase.from("farm_parcels").select("*").eq("store_id", storeId);
  if (data && db) await db.farmParcels.bulkPut(data);
  return data || [];
}

export async function saveParcel(
  storeId: string,
  parcel: Partial<FarmParcel> & { name: string; area_hectares: number; crop_type: string }
): Promise<FarmParcel> {
  const localId = parcel.id || generateLocalId();
  const record: FarmParcel = {
    id: localId,
    store_id: storeId,
    name: parcel.name,
    area_hectares: parcel.area_hectares,
    crop_type: parcel.crop_type,
    sowing_date: parcel.sowing_date ?? null,
    stage: (parcel.stage as FarmStage) || "growth",
    expected_yield_kg: parcel.expected_yield_kg ?? null,
    harvested_kg: parcel.harvested_kg ?? 0,
    latitude: parcel.latitude ?? null,
    longitude: parcel.longitude ?? null,
    _localId: localId.startsWith("local-") ? localId : undefined,
    _pendingSync: true,
  };

  if (db) await db.farmParcels.put(record);

  if (navigator.onLine) {
    const { data } = await supabase
      .from("farm_parcels")
      .upsert({
        id: localId.startsWith("local-") ? undefined : localId,
        store_id: storeId,
        name: record.name,
        area_hectares: record.area_hectares,
        crop_type: record.crop_type,
        sowing_date: record.sowing_date,
        stage: record.stage,
        expected_yield_kg: record.expected_yield_kg,
        harvested_kg: record.harvested_kg,
        latitude: record.latitude,
        longitude: record.longitude,
      })
      .select()
      .single();
    if (data) {
      record.id = data.id;
      record._pendingSync = false;
      if (db) await db.farmParcels.put(record);
    }
  }
  return record;
}

export function calcYieldPerHectare(parcel: FarmParcel): number {
  if (!parcel.area_hectares || !parcel.harvested_kg) return 0;
  return Math.round((parcel.harvested_kg / parcel.area_hectares) * 100) / 100;
}

export function getTipsForRegion(region = "west_africa", crop = "general"): string[] {
  const regionData = (tipsData as Record<string, Record<string, string[]>>)[region]
    || (tipsData as Record<string, Record<string, string[]>>).default;
  return regionData?.[crop] || regionData?.general || [];
}

export async function mockWeather(lat?: number, lon?: number) {
  return {
    temp_c: 28 + Math.floor(Math.random() * 6),
    condition: lat && lon ? "Pluies éparses" : "Ensoleillé",
    humidity: 65,
    alert: "Risque faible de sécheresse cette semaine (simulation).",
    source: "mock",
  };
}
