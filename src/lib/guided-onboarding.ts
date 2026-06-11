import { ALL_MODULE_IDS } from "@/lib/modules/config";
import type { ModuleId } from "@/types";

export interface GuidedStep {
  href: string;
}

const GUIDED_DONE_KEY = "wazo_guided_onboarding_done";

export const GUIDED_STEPS_BY_MODULE: Record<ModuleId, GuidedStep> = {
  commerce: { href: "/products/add" },
  health: { href: "/health/patients/new" },
  agriculture: { href: "/agriculture/parcels/new" },
  logistics: { href: "/logistics/deliveries/new" },
  education: { href: "/education/courses/new" },
  blockchain: { href: "/blockchain/assets/new" },
};

export function guidedTitleKey(moduleId: ModuleId): string {
  return `guided.${moduleId}.title`;
}

export function guidedDescKey(moduleId: ModuleId): string {
  return `guided.${moduleId}.desc`;
}

export function guidedCtaKey(moduleId: ModuleId): string {
  return `guided.${moduleId}.cta`;
}

export function isGuidedOnboardingDone(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(GUIDED_DONE_KEY) === "1";
}

export function markGuidedOnboardingDone() {
  if (typeof window === "undefined") return;
  localStorage.setItem(GUIDED_DONE_KEY, "1");
}

export function resetGuidedOnboarding() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(GUIDED_DONE_KEY);
}

export type GuidedStepWithModule = GuidedStep & { moduleId: ModuleId };

export function getGuidedStepsForModules(modules: ModuleId[]): GuidedStepWithModule[] {
  const active = modules.length ? modules : (["commerce"] as ModuleId[]);
  return ALL_MODULE_IDS.filter((id) => active.includes(id)).map((id) => ({
    ...GUIDED_STEPS_BY_MODULE[id],
    moduleId: id,
  }));
}
