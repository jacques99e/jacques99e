export interface CulturalTask {
  id: string;
  crop: string;
  task: string;
  dueDate: string;
  done: boolean;
  note: string;
}

const KEY = "wazo_cultural_calendar";

export const CROP_IDS = ["maize", "cocoa", "coffee", "cashew", "rice", "other"] as const;
export type CropId = (typeof CROP_IDS)[number];

const PRESET_TASK_KEYS: Record<string, string[]> = {
  maize: [
    "calendar.preset.maize.soilPrep",
    "calendar.preset.maize.sowing",
    "calendar.preset.maize.weeding",
    "calendar.preset.maize.fertilizer",
    "calendar.preset.maize.harvest",
  ],
  cocoa: [
    "calendar.preset.cocoa.pruning",
    "calendar.preset.cocoa.treatment",
    "calendar.preset.cocoa.harvest",
    "calendar.preset.cocoa.drying",
  ],
  coffee: [
    "calendar.preset.coffee.pruning",
    "calendar.preset.coffee.treatment",
    "calendar.preset.coffee.harvest",
    "calendar.preset.coffee.drying",
  ],
  cashew: [
    "calendar.preset.cashew.pruning",
    "calendar.preset.cashew.treatment",
    "calendar.preset.cashew.harvest",
    "calendar.preset.cashew.drying",
  ],
  rice: [
    "calendar.preset.rice.prep",
    "calendar.preset.rice.transplant",
    "calendar.preset.rice.fertilizer",
    "calendar.preset.rice.harvest",
  ],
};

const PRESET_OFFSETS = [7, 21, 45, 70, 100];

function storageKey(storeId?: string): string {
  return storeId ? `${KEY}_${storeId}` : KEY;
}

export function readCulturalTasks(storeId?: string): CulturalTask[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(storeId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as CulturalTask[]) : [];
  } catch {
    return [];
  }
}

export function writeCulturalTasks(tasks: CulturalTask[], storeId?: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(storeId), JSON.stringify(tasks));
}

export function addCulturalTask(
  task: Omit<CulturalTask, "id">,
  storeId?: string
): CulturalTask[] {
  const rows = readCulturalTasks(storeId);
  const next: CulturalTask = { ...task, id: `task-${Date.now()}` };
  const updated = [next, ...rows];
  writeCulturalTasks(updated, storeId);
  return updated;
}

export function toggleCulturalTask(taskId: string, storeId?: string): CulturalTask[] {
  const rows = readCulturalTasks(storeId).map((t) =>
    t.id === taskId ? { ...t, done: !t.done } : t
  );
  writeCulturalTasks(rows, storeId);
  return rows;
}

export function upcomingTasks(tasks: CulturalTask[]): CulturalTask[] {
  const today = new Date().toISOString().slice(0, 10);
  return tasks
    .filter((t) => !t.done && t.dueDate >= today)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export function presetTasksForCrop(cropId: string): { key: string; offsetDays: number }[] {
  const keys = PRESET_TASK_KEYS[cropId] ?? [];
  return keys.map((key, i) => ({ key, offsetDays: PRESET_OFFSETS[i] ?? (i + 1) * 14 }));
}

export function cropLabelKey(cropId: string): string {
  return `crops.${cropId}`;
}
