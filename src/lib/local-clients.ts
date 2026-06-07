import { notifyAlertsChanged } from "@/lib/alerts";

export type ClientStatus = "prospect" | "active" | "relance";

export interface LocalClientRecord {
  id: string;
  store_id?: string;
  name: string;
  phone: string;
  tags: string[];
  status: ClientStatus;
  nextFollowUp: string | null;
  note: string;
  cloud_id?: string | null;
  updated_at?: string;
}

const CLIENTS_KEY = "wazo_clients";

function storageKey(storeId?: string): string {
  return storeId ? `${CLIENTS_KEY}_${storeId}` : CLIENTS_KEY;
}

export function readLocalClients(storeId?: string): LocalClientRecord[] {
  if (typeof window === "undefined") return [];
  const keys = storeId
    ? [storageKey(storeId), CLIENTS_KEY]
    : [CLIENTS_KEY];
  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) continue;
      return (parsed as LocalClientRecord[]).map((c) => ({
        ...c,
        store_id: c.store_id || storeId,
        tags: Array.isArray(c.tags) ? c.tags : [],
      }));
    } catch {
      continue;
    }
  }
  return [];
}

export function writeLocalClients(clients: LocalClientRecord[], storeId?: string) {
  if (typeof window === "undefined") return;
  const key = storageKey(storeId);
  localStorage.setItem(key, JSON.stringify(clients));
  if (storeId) {
    localStorage.setItem(CLIENTS_KEY, JSON.stringify(clients));
  }
  notifyAlertsChanged();
}

export function mergeCloudClients(
  storeId: string,
  cloudRows: Array<{
    id: string;
    external_local_id: string | null;
    name: string;
    phone: string | null;
    tags: unknown;
    status: string;
    next_follow_up: string | null;
    note: string | null;
    updated_at?: string;
  }>
): LocalClientRecord[] {
  const local = readLocalClients(storeId);
  const byExternal = new Map<string, LocalClientRecord>();
  const byCloud = new Map<string, LocalClientRecord>();

  for (const c of local) {
    byExternal.set(c.id, c);
    if (c.cloud_id) byCloud.set(c.cloud_id, c);
  }

  for (const row of cloudRows) {
    const extId = row.external_local_id || row.id;
    const existing = byExternal.get(extId) || (row.id ? byCloud.get(row.id) : undefined);
    const tags = Array.isArray(row.tags) ? (row.tags as string[]) : [];
    const merged: LocalClientRecord = {
      id: extId,
      store_id: storeId,
      cloud_id: row.id,
      name: row.name,
      phone: row.phone || "",
      tags,
      status: (row.status as ClientStatus) || "prospect",
      nextFollowUp: row.next_follow_up,
      note: row.note || "",
      updated_at: row.updated_at,
    };
    if (existing) {
      const localTime = existing.updated_at ? Date.parse(existing.updated_at) : 0;
      const cloudTime = row.updated_at ? Date.parse(row.updated_at) : 0;
      if (cloudTime >= localTime) {
        byExternal.set(extId, merged);
      }
    } else {
      byExternal.set(extId, merged);
    }
  }

  const merged = [...byExternal.values()];
  writeLocalClients(merged, storeId);
  return merged;
}
