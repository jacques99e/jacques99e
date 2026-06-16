import { apiFetch } from "@/lib/api-client";
import { db } from "@/lib/db";
import { isCloudUuid } from "@/lib/cloud-uuid";
import { supabase } from "@/lib/supabase/client";
import { generateLocalId } from "@/lib/sync";
import type { Delivery, DeliveryStatus } from "@/types";

export function generateTrackingCode(): string {
  return `WZ${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export async function listDeliveries(storeId: string): Promise<Delivery[]> {
  if (navigator.onLine) {
    try {
      const response = await apiFetch(
        `/api/logistics/deliveries?store_id=${encodeURIComponent(storeId)}`,
        { cache: "no-store" }
      );
      const payload = (await response.json()) as { deliveries?: Delivery[] };
      if (response.ok && payload.deliveries) {
        if (db && payload.deliveries.length > 0) {
          await db.deliveries.where("store_id").equals(storeId).delete();
          await db.deliveries.bulkPut(
            payload.deliveries.map((d) => ({ ...d, _pendingSync: false }))
          );
        }
        return payload.deliveries;
      }
    } catch {
      // Fallback below.
    }
  }

  if (db) {
    const local = await db.deliveries.where("store_id").equals(storeId).toArray();
    if (local.length > 0) return local;
  }

  if (!navigator.onLine) return [];
  const { data } = await supabase
    .from("deliveries")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });
  if (data && db) await db.deliveries.bulkPut(data.map((d) => ({ ...d, _pendingSync: false })));
  return data || [];
}

export async function createDelivery(
  storeId: string,
  input: Omit<Delivery, "id" | "store_id" | "tracking_code" | "status">
): Promise<Delivery> {
  const localId = generateLocalId();
  const delivery: Delivery = {
    id: localId,
    store_id: storeId,
    tracking_code: generateTrackingCode(),
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
    const response = await apiFetch("/api/logistics/deliveries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        store_id: storeId,
        sender_name: input.sender_name,
        recipient_name: input.recipient_name,
        recipient_phone: input.recipient_phone,
        address: input.address,
      }),
    });
    const payload = (await response.json()) as {
      delivery?: Delivery;
      error?: string;
    };
    if (!response.ok || !payload.delivery) {
      throw new Error(payload.error || "Impossible d'enregistrer la livraison en ligne.");
    }
    const saved = { ...payload.delivery, _pendingSync: false };
    if (db) {
      await db.deliveries.delete(localId);
      await db.deliveries.put(saved);
    }
    return saved;
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
  if (!navigator.onLine) return;

  if (!isCloudUuid(id)) {
    throw new Error("Livraison non synchronisee. Reconnectez-vous puis reessayez.");
  }

  const response = await apiFetch("/api/logistics/deliveries", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, status, signature_data }),
  });
  const payload = (await response.json()) as { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || "Impossible de mettre a jour la livraison.");
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
