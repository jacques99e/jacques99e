import { localStore } from "@/lib/db";
import { generateLocalId } from "@/lib/sync";

export interface PatientFollowUp {
  id: string;
  store_id: string;
  patient_name: string;
  due_date: string;
  reason: string;
  phone?: string;
  done: boolean;
}

function storageKey(storeId: string) {
  return `wazo_health_followups_${storeId}`;
}

export function listFollowUps(storeId?: string): PatientFollowUp[] {
  const sid = storeId ?? localStore.get()?.id;
  if (!sid || typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(sid));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PatientFollowUp[];
    return Array.isArray(parsed)
      ? parsed.sort((a, b) => a.due_date.localeCompare(b.due_date))
      : [];
  } catch {
    return [];
  }
}

export function saveFollowUps(storeId: string, rows: PatientFollowUp[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(storeId), JSON.stringify(rows));
}

export function addFollowUp(
  storeId: string,
  input: Omit<PatientFollowUp, "id" | "store_id" | "done"> & { done?: boolean }
): PatientFollowUp {
  const row: PatientFollowUp = {
    id: generateLocalId(),
    store_id: storeId,
    done: input.done ?? false,
    patient_name: input.patient_name,
    due_date: input.due_date,
    reason: input.reason,
    phone: input.phone,
  };
  saveFollowUps(storeId, [...listFollowUps(storeId), row]);
  return row;
}

export function toggleFollowUpDone(storeId: string, id: string, done: boolean) {
  saveFollowUps(
    storeId,
    listFollowUps(storeId).map((f) => (f.id === id ? { ...f, done } : f))
  );
}

export function deleteFollowUp(storeId: string, id: string) {
  saveFollowUps(
    storeId,
    listFollowUps(storeId).filter((f) => f.id !== id)
  );
}

export function overdueFollowUps(storeId?: string, today = new Date()): PatientFollowUp[] {
  const iso = today.toISOString().slice(0, 10);
  return listFollowUps(storeId).filter((f) => !f.done && f.due_date < iso);
}
