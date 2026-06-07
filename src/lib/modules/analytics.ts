import { MODULES } from "@/lib/modules/config";
import type { ModuleId } from "@/types";

export interface AnalyticsShortcut {
  href: string;
  label: string;
  moduleId: ModuleId;
}

export const ANALYTICS_SHORTCUTS: AnalyticsShortcut[] = [
  { moduleId: "commerce", href: "/products", label: "Détail produits" },
  { moduleId: "commerce", href: "/sales/history", label: "Historique ventes" },
  { moduleId: "logistics", href: "/logistics", label: "Performance logistique" },
  { moduleId: "education", href: "/education", label: "Performance formation" },
  { moduleId: "health", href: "/health", label: "Module santé" },
  { moduleId: "agriculture", href: "/agriculture", label: "Module agriculture" },
  { moduleId: "blockchain", href: "/blockchain", label: "Traçabilité" },
];

export function analyticsShortcutsForModules(modules: ModuleId[]): AnalyticsShortcut[] {
  const active = new Set(modules);
  return ANALYTICS_SHORTCUTS.filter((item) => active.has(item.moduleId));
}

export function moduleOpsLabels(modules: ModuleId[]): Array<{
  key: keyof ModuleOpsSnapshot;
  label: string;
  moduleId: ModuleId;
}> {
  const rows: Array<{ key: keyof ModuleOpsSnapshot; label: string; moduleId: ModuleId }> = [];
  if (modules.includes("logistics")) rows.push({ key: "deliveries", label: "Livraisons", moduleId: "logistics" });
  if (modules.includes("health")) rows.push({ key: "patients", label: "Patients", moduleId: "health" });
  if (modules.includes("education")) rows.push({ key: "courses", label: "Cours", moduleId: "education" });
  if (modules.includes("blockchain")) rows.push({ key: "assets", label: "Actifs", moduleId: "blockchain" });
  if (modules.includes("agriculture")) rows.push({ key: "parcels", label: "Parcelles", moduleId: "agriculture" });
  return rows;
}

export interface ModuleOpsSnapshot {
  deliveries: number;
  patients: number;
  courses: number;
  assets: number;
  parcels: number;
}

export const EMPTY_MODULE_OPS: ModuleOpsSnapshot = {
  deliveries: 0,
  patients: 0,
  courses: 0,
  assets: 0,
  parcels: 0,
};

export function primaryAnalyticsPath(modules: ModuleId[]): string {
  const primary = modules[0] ?? "commerce";
  return MODULES[primary].path;
}
