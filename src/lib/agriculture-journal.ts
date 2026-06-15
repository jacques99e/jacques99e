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

export function addFieldJournalEntry(
  storeId: string,
  input: Omit<FieldJournalEntry, "id" | "store_id">
): FieldJournalEntry {
  const row: FieldJournalEntry = {
    id: generateLocalId(),
    store_id: storeId,
    ...input,
  };
  saveFieldJournal(storeId, [row, ...listFieldJournal(storeId)]);
  return row;
}

export function deleteFieldJournalEntry(storeId: string, id: string) {
  saveFieldJournal(
    storeId,
    listFieldJournal(storeId).filter((e) => e.id !== id)
  );
}
