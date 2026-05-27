import { db } from "@/lib/db";
import { supabase } from "@/lib/supabase/client";
import { generateLocalId } from "@/lib/sync";
import type { Delivery, DeliveryStatus } from "@/types";

export function generateTrackingCode(): string {
  return `WZ${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export async function listDeliveries(storeId: string): Promise<Delivery[]> {
  if (db) {
    const local = await db.deliveries.where("store_id").equals(storeId).toArray();
    if (local.length || !navigator.onLine) return local;
  }
  if (!navigator.onLine) return [];
  const { data } = await supabase
    .from("deliveries")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });
  if (data && db) await db.deliveries.bulkPut(data);
  return data || [];
}

export async function createDelivery(
  storeId: string,
  input: Omit<Delivery, "id" | "store_id" | "tracking_code" | "status">
): Promise<Delivery> {
  const localId = generateLocalId();
  const tracking_code = generateTrackingCode();
  const delivery: Delivery = {
    id: localId,
    store_id: storeId,
    tracking_code,
    sender_name: input.sender_name,
    recipient_name: input.recipient_name,
    recipient_phone: input.recipient_phone ?? null,
    address: input.address,
    status: "pending",
    _localId: localId,
    _pendingSync: true,
  };

  if (db) await db.deliveries.put(delivery);

  if (navigator.onLine) {
    const { data } = await supabase
      .from("deliveries")
      .insert({
        store_id: storeId,
        tracking_code,
        sender_name: input.sender_name,
        recipient_name: input.recipient_name,
        recipient_phone: input.recipient_phone,
        address: input.address,
        status: "pending",
      })
      .select()
      .single();
    if (data) {
      delivery.id = data.id;
      delivery._pendingSync = false;
      if (db) await db.deliveries.put(delivery);
    }
  }
  return delivery;
}

export async function updateDeliveryStatus(
  id: string,
  status: DeliveryStatus,
  signature_data?: string
): Promise<void> {
  if (db) {
    await db.deliveries.update(id, { status, signature_data, updated_at: new Date().toISOString() });
  }
  if (navigator.onLine) {
    await supabase
      .from("deliveries")
      .update({ status, signature_data, updated_at: new Date().toISOString() })
      .eq("id", id);
  }
}

export async function getRouteSummary(
  origin: string,
  destination: string
): Promise<string> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
  if (!apiKey) {
    return `Itinéraire simulé: ${origin} → ${destination} (~12 km, 25 min)`;
  }
  try {
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();
    const leg = data.routes?.[0]?.legs?.[0];
    if (leg) return `${leg.distance?.text} — ${leg.duration?.text}`;
  } catch {
    /* fallback */
  }
  return `Itinéraire: ${origin} → ${destination}`;
}
