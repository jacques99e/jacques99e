import { apiFetch } from "@/lib/api-client";
import { localStore } from "@/lib/db";
import { generateLocalId } from "@/lib/sync";

export interface FieldJournalEntry {
  id: string;
  store_id: string;
  date: string;
  parcel_label: string;
  activity: string;
  notes: string;
}

function storageKey(storeId: string) {
  return `wazo_agri_journal_${storeId}`;
}

export function listFieldJournal(storeId?: string): FieldJournalEntry[] {
  const sid = storeId ?? localStore.get()?.id;
  if (!sid || typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(sid));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FieldJournalEntry[];
    return Array.isArray(parsed)
      ? parsed.sort((a, b) => b.date.localeCompare(a.date))
      : [];
  } catch {
    return [];
  }
}

export function saveFieldJournal(storeId: string, rows: FieldJournalEntry[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(storeId), JSON.stringify(rows));
}

function asEntries(value: unknown, storeId: string): FieldJournalEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is FieldJournalEntry => {
    if (!row || typeof row !== "object") return false;
    const entry = row as FieldJournalEntry;
    return entry.store_id === storeId && typeof entry.id === "string" && typeof entry.date === "string";
  });
}

async function pushFieldJournalEntry(row: FieldJournalEntry) {
  await apiFetch("/api/agriculture/journal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(row),
  });
}

/** Met à jour le cache local. listFieldJournal reste synchrone pour les lecteurs existants. */
export async function syncFieldJournal(storeId: string): Promise<FieldJournalEntry[]> {
  if (typeof window === "undefined" || !storeId) return listFieldJournal(storeId);
  try {
    const res = await apiFetch(`/api/agriculture/journal?storeId=${encodeURIComponent(storeId)}`);
    const json = (await res.json()) as { success?: boolean; entries?: unknown };
    if (!res.ok || !json.success) return listFieldJournal(storeId);
    const cloud = asEntries(json.entries, storeId);
    const cloudIds = new Set(cloud.map((row) => row.id));
    const pending = listFieldJournal(storeId).filter((row) => row.id && !cloudIds.has(row.id));
    const merged = [...cloud, ...pending].sort((a, b) => b.date.localeCompare(a.date));
    saveFieldJournal(storeId, merged);
    for (const row of pending) {
      void pushFieldJournalEntry(row).catch(() => undefined);
    }
    return merged;
  } catch {
    return listFieldJournal(storeId);
  }
}

export function addFieldJournalEntry(
  storeId: string,
  input: Omit<FieldJournalEntry, "id" | "store_id">
): FieldJournalEntry {
  const row: FieldJournalEntry = {
    id: generateLocalId(),
    store_id: storeId,
    date: input.date.slice(0, 10),
    parcel_label: input.parcel_label.trim().slice(0, 80),
    activity: input.activity.trim().slice(0, 40),
    notes: input.notes.trim().slice(0, 500),
  };
  saveFieldJournal(storeId, [row, ...listFieldJournal(storeId)]);
  void pushFieldJournalEntry(row).catch(() => undefined);
  return row;
}

export function deleteFieldJournalEntry(storeId: string, id: string) {
  saveFieldJournal(
    storeId,
    listFieldJournal(storeId).filter((e) => e.id !== id)
  );
  void apiFetch("/api/agriculture/journal", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ store_id: storeId, id }),
  }).catch(() => undefined);
}
