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
  }

  return record;
}

export function cultureStageToFarmStage(stage: string): FarmStage {
  if (stage === "floraison") return "flowering";
  if (stage === "récolte") return "harvest";
  if (stage === "préparation") return "fallow";
  return "growth";
}

export function farmStageToCultureStage(
  stage: string
): "préparation" | "semis" | "croissance" | "floraison" | "récolte" {
  if (stage === "flowering") return "floraison";
  if (stage === "harvest") return "récolte";
  if (stage === "fallow") return "préparation";
  return "croissance";
}

export async function deleteParcel(storeId: string, parcelId: string): Promise<void> {
  if (!isCloudUuid(parcelId)) return;
  const response = await apiFetch(
    `/api/agriculture/parcels?storeId=${encodeURIComponent(storeId)}&id=${encodeURIComponent(parcelId)}`,
    { method: "DELETE" }
  );
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error || "Suppression impossible.");
  }
  if (db) await db.farmParcels.delete(parcelId);
}

export interface FarmInputRow {
  id: string;
  type: "engrais" | "pesticides" | "eau";
  name: string;
  quantity: number;
  date: string;
  plotId: string;
  plotName: string;
}

export interface YieldRow {
  id: string;
  harvestKg: number;
  areaHa: number;
  result: number;
  createdAt: string;
}

export async function listFarmInputs(storeId: string): Promise<FarmInputRow[]> {
  const response = await apiFetch(`/api/agriculture/records?storeId=${encodeURIComponent(storeId)}&kind=input`);
  const payload = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    records?: Array<{
      id: string;
      parcel_id: string;
      input_type: FarmInputRow["type"];
      quantity: number;
      notes: string | null;
      applied_at: string;
      plot_name: string;
    }>;
  };
  if (!response.ok || !payload.success) return [];
  return (payload.records || []).map((row) => ({
    id: row.id,
    type: row.input_type,
    name: row.notes || row.input_type,
    quantity: Number(row.quantity) || 0,
    date: row.applied_at,
    plotId: row.parcel_id,
    plotName: row.plot_name,
  }));
}

export async function saveFarmInput(
  storeId: string,
  input: Omit<FarmInputRow, "id" | "plotName">
): Promise<FarmInputRow> {
  const response = await apiFetch("/api/agriculture/records", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      store_id: storeId,
      kind: "input",
      parcel_id: input.plotId,
      input_type: input.type,
      name: input.name,
      quantity: input.quantity,
      date: input.date,
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    error?: string;
    record?: {
      id: string;
      parcel_id: string;
      input_type: FarmInputRow["type"];
      quantity: number;
      notes: string | null;
      applied_at: string;
      plot_name: string;
    };
  };
  if (!response.ok || !payload.success || !payload.record) {
    throw new Error(payload.error || "Impossible d'enregistrer l'intrant.");
  }
  const row = payload.record;
  return {
    id: row.id,
    type: row.input_type,
    name: row.notes || input.name,
    quantity: Number(row.quantity) || input.quantity,
    date: row.applied_at,
    plotId: row.parcel_id,
    plotName: row.plot_name,
  };
}

export async function listYieldHistory(storeId: string): Promise<YieldRow[]> {
  const response = await apiFetch(`/api/agriculture/records?storeId=${encodeURIComponent(storeId)}&kind=yield`);
  const payload = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    records?: Array<{ id: string; created_at: string; payload?: { harvest_kg?: number; area_ha?: number; result?: number } }>;
  };
  if (!response.ok || !payload.success) return [];
  return (payload.records || []).map((row) => ({
    id: row.id,
    harvestKg: Number(row.payload?.harvest_kg) || 0,
    areaHa: Number(row.payload?.area_ha) || 0,
    result: Number(row.payload?.result) || 0,
    createdAt: row.created_at,
  }));
}

export async function saveYieldRecord(
  storeId: string,
  input: Omit<YieldRow, "id" | "createdAt">
): Promise<YieldRow> {
  const response = await apiFetch("/api/agriculture/records", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      store_id: storeId,
      kind: "yield",
      harvest_kg: input.harvestKg,
      area_ha: input.areaHa,
      result: input.result,
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    error?: string;
    record?: { id: string; created_at: string; payload?: { harvest_kg?: number; area_ha?: number; result?: number } };
  };
  if (!response.ok || !payload.success || !payload.record) {
    throw new Error(payload.error || "Impossible d'enregistrer le rendement.");
  }
  return {
    id: payload.record.id,
    harvestKg: Number(payload.record.payload?.harvest_kg) || input.harvestKg,
    areaHa: Number(payload.record.payload?.area_ha) || input.areaHa,
    result: Number(payload.record.payload?.result) || input.result,
    createdAt: payload.record.created_at,
  };
}

export function readLocalCultures<T = unknown>(): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("wazo_cultures");
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
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
