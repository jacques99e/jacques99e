import type { HealthAppointment } from "@/types";

const apptKey = (storeId: string) => `wazo_health_appts_${storeId}`;

export function readLocalAppointments(storeId: string): HealthAppointment[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(apptKey(storeId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HealthAppointment[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeLocalAppointments(storeId: string, items: HealthAppointment[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(apptKey(storeId), JSON.stringify(items));
}

export function appendLocalAppointment(storeId: string, appointment: HealthAppointment) {
  const list = readLocalAppointments(storeId);
  writeLocalAppointments(storeId, [appointment, ...list]);
}
