import { localModules } from "@/lib/db";
import { normalizeModuleIds } from "@/lib/modules/config";
import { setBusinessVertical } from "@/lib/onboarding";
import type { ModuleId } from "@/types";

const PENDING_KEY = "wazo_pending_module";
const PENDING_PLAN_KEY = "wazo_pending_plan";

export function readPendingModule(): ModuleId | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(PENDING_KEY) ?? new URLSearchParams(window.location.search).get("module");
  if (!raw) return null;
  const ids = normalizeModuleIds([raw]);
  return ids[0] ?? null;
}

export function savePendingModule(moduleId: string) {
  if (typeof window === "undefined") return;
  const ids = normalizeModuleIds([moduleId]);
  if (!ids.length) return;
  sessionStorage.setItem(PENDING_KEY, ids[0]);
}

export function applyPendingModule(): ModuleId | null {
  const pending = readPendingModule();
  if (!pending) return null;
  const modules = normalizeModuleIds([pending]);
  localModules.save(modules);
  setBusinessVertical(modules[0]);
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(PENDING_KEY);
  }
  return modules[0];
}

export function savePendingPlan(planId: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(PENDING_PLAN_KEY, planId);
}

export function readPendingPlan(): string | null {
  if (typeof window === "undefined") return null;
  return (
    sessionStorage.getItem(PENDING_PLAN_KEY) ??
    new URLSearchParams(window.location.search).get("plan")
  );
}

export function applyPendingPlan(): string | null {
  const pending = readPendingPlan();
  if (!pending) return null;
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(PENDING_PLAN_KEY);
  }
  return pending;
}
