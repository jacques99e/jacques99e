import tipsData from "@/data/agriculture-tips.json";
import { apiFetch } from "@/lib/api-client";
import { db } from "@/lib/db";
import { isCloudUuid } from "@/lib/cloud-uuid";
import { supabase } from "@/lib/supabase/client";
import { generateLocalId } from "@/lib/sync";
import type { FarmParcel, FarmStage } from "@/types";

export async function listParcels(storeId: string): Promise<FarmParcel[]> {
  if (navigator.onLine) {
    const { data } = await supabase.from("farm_parcels").select("*").eq("store_id", storeId);
    if (data && db && data.length > 0) {
      await db.farmParcels.where("store_id").equals(storeId).delete();
      await db.farmParcels.bulkPut(data.map((p) => ({ ...p, _pendingSync: false })));
      return data;
    }
  }

  if (db) {
    const local = await db.farmParcels.where("store_id").equals(storeId).toArray();
    if (local.length > 0) return local;
  }

  if (!navigator.onLine) return [];
  const { data } = await supabase.from("farm_parcels").select("*").eq("store_id", storeId);
  if (data && db) await db.farmParcels.bulkPut(data.map((p) => ({ ...p, _pendingSync: false })));
  return data || [];
}

export async function saveParcel(
  storeId: string,
  parcel: Partial<FarmParcel> & { name: string; area_hectares: number; crop_type: string }
): Promise<FarmParcel> {
  const hasServerId = Boolean(parcel.id && isCloudUuid(parcel.id));
  const localId = hasServerId ? undefined : parcel._localId || generateLocalId();
  const id = hasServerId ? parcel.id! : localId!;

  const record: FarmParcel = {
    id,
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
    _localId: localId,
    _pendingSync: true,
  };

  if (db) await db.farmParcels.put(record);

  if (navigator.onLine) {
    try {
      const response = await apiFetch("/api/agriculture/parcels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
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
      }),
    });
    const payload = (await response.json()) as { success: boolean; parcel?: FarmParcel; error?: string };
    if (!response.ok || !payload.success || !payload.parcel) {
      throw new Error(payload.error || "Impossible d'enregistrer la parcelle en ligne.");
    }
    const saved = { ...payload.parcel, _pendingSync: false };
    if (db) {
      if (localId) await db.farmParcels.delete(localId);
      await db.farmParcels.put(saved);
    }
    return saved;
    } catch {
      // Keep local record for offline / retry.
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
