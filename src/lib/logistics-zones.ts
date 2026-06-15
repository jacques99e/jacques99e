import { localStore } from "@/lib/db";
import { generateLocalId } from "@/lib/sync";

export interface DeliveryZone {
  id: string;
  store_id: string;
  name: string;
  fee: number;
  eta_hours: number;
}

function storageKey(storeId: string) {
  return `wazo_logistics_zones_${storeId}`;
}

export function listDeliveryZones(storeId?: string): DeliveryZone[] {
  const sid = storeId ?? localStore.get()?.id;
  if (!sid || typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(sid));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DeliveryZone[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveDeliveryZones(storeId: string, rows: DeliveryZone[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(storeId), JSON.stringify(rows));
}

export function addDeliveryZone(
  storeId: string,
  input: Omit<DeliveryZone, "id" | "store_id">
): DeliveryZone {
  const row: DeliveryZone = {
    id: generateLocalId(),
    store_id: storeId,
    ...input,
  };
  saveDeliveryZones(storeId, [...listDeliveryZones(storeId), row]);
  return row;
}

export function deleteDeliveryZone(storeId: string, id: string) {
  saveDeliveryZones(
    storeId,
    listDeliveryZones(storeId).filter((z) => z.id !== id)
  );
}

export function estimateDeliveryFee(
  zoneName: string,
  storeId?: string
): DeliveryZone | null {
  const q = zoneName.trim().toLowerCase();
  if (!q) return null;
  return (
    listDeliveryZones(storeId).find((z) => z.name.toLowerCase() === q) ??
    listDeliveryZones(storeId).find((z) => q.includes(z.name.toLowerCase())) ??
    null
  );
}
