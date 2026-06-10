export interface CulturalTask {
  id: string;
  crop: string;
  task: string;
  dueDate: string;
  done: boolean;
  note: string;
}

const KEY = "wazo_cultural_calendar";

const PRESET_TASKS: Record<string, string[]> = {
  Maïs: ["Préparation sol", "Semis", "Premier désherbage", "Fertilisation NPK", "Récolte"],
  Cacao: ["Taille ombrière", "Traitement cabosse", "Récolte cabosses mûres", "Séchage / fermentation"],
  Café: ["Taille", "Traitement antiparasitaire", "Récolte cerises", "Séchage"],
  Anacarde: ["Taille", "Traitement maladie", "Récolte pommes", "Séchage noix"],
  Riz: ["Préparation rizière", "Repiquage", "Fertilisation", "Récolte"],
};

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

export function toggleCulturalTask(
  id: string,
  storeId?: string
): CulturalTask[] {
  const rows = readCulturalTasks(storeId);
  const updated = rows.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
  writeCulturalTasks(updated, storeId);
  return updated;
}

export function presetTasksForCrop(crop: string): string[] {
  return PRESET_TASKS[crop] ?? ["Semis / plantation", "Entretien", "Traitement", "Récolte"];
}

export function upcomingTasks(tasks: CulturalTask[], days = 14): CulturalTask[] {
  const today = new Date().toISOString().slice(0, 10);
  const limit = new Date();
  limit.setDate(limit.getDate() + days);
  const max = limit.toISOString().slice(0, 10);
  return tasks
    .filter((t) => !t.done && t.dueDate >= today && t.dueDate <= max)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}
