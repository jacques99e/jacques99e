export interface AttendanceRecord {
  id: string;
  courseTitle: string;
  sessionDate: string;
  studentName: string;
  present: boolean;
  note: string;
}

const KEY = "wazo_attendance";

function storageKey(storeId?: string): string {
  return storeId ? `${KEY}_${storeId}` : KEY;
}

export function readAttendance(storeId?: string): AttendanceRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(storeId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as AttendanceRecord[]) : [];
  } catch {
    return [];
  }
}

export function writeAttendance(records: AttendanceRecord[], storeId?: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(storeId), JSON.stringify(records));
}

export function addAttendanceRecord(
  record: Omit<AttendanceRecord, "id">,
  storeId?: string
): AttendanceRecord[] {
  const rows = readAttendance(storeId);
  const next: AttendanceRecord = { ...record, id: `att-${Date.now()}` };
  const updated = [next, ...rows].slice(0, 500);
  writeAttendance(updated, storeId);
  return updated;
}

export function toggleAttendance(
  id: string,
  storeId?: string
): AttendanceRecord[] {
  const rows = readAttendance(storeId);
  const updated = rows.map((r) => (r.id === id ? { ...r, present: !r.present } : r));
  writeAttendance(updated, storeId);
  return updated;
}

export function attendanceRateForSession(
  records: AttendanceRecord[],
  courseTitle: string,
  sessionDate: string
): { present: number; total: number; rate: number } {
  const session = records.filter(
    (r) => r.courseTitle === courseTitle && r.sessionDate === sessionDate
  );
  const present = session.filter((r) => r.present).length;
  const total = session.length;
  return { present, total, rate: total ? Math.round((present / total) * 100) : 0 };
}
