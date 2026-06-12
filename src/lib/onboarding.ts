import { BILLING_MANAGE_HREF } from "@/lib/billing-checkout";
import { ALL_MODULE_IDS } from "@/lib/modules/config";
import type { ModuleId } from "@/types";

const BILLING_UPGRADE_HREF = BILLING_MANAGE_HREF;

/** Secteur d'activité = module principal pour l'onboarding métier */
export type BusinessVertical = ModuleId;

export interface OnboardingTaskDef {
  id: string;
  href: string;
}

const VERTICAL_KEY = "wazo_business_vertical";
const PROGRESS_KEY = "wazo_onboarding_progress";
const LEGACY_KEY = "wazo_onboarding_tasks";

export const ONBOARDING_VERTICAL_ORDER: BusinessVertical[] = ALL_MODULE_IDS;

export function verticalLabelKey(vertical: BusinessVertical): string {
  return `onboarding.vertical.${vertical}`;
}

export function taskLabelKey(taskId: string): string {
  return `onboarding.task.${taskId}`;
}

export const ONBOARDING_BY_VERTICAL: Record<BusinessVertical, OnboardingTaskDef[]> = {
  commerce: [
    { id: "product", href: "/products/add" },
    { id: "sale", href: "/sales" },
    { id: "catalog", href: "/products" },
    { id: "vitrine", href: "/profile" },
    { id: "billing", href: BILLING_UPGRADE_HREF },
  ],
  health: [
    { id: "patient", href: "/health/patients/new" },
    { id: "appointment", href: "/health/appointments/new" },
    { id: "remind", href: "/health/appointments" },
    { id: "billing", href: BILLING_UPGRADE_HREF },
  ],
  agriculture: [
    { id: "parcel", href: "/agriculture/parcels/new" },
    { id: "marches", href: "/agriculture/marches" },
    { id: "rendement", href: "/agriculture/rendement" },
    { id: "sale", href: "/products/add?category=Agriculture" },
    { id: "billing", href: BILLING_UPGRADE_HREF },
  ],
  logistics: [
    { id: "delivery", href: "/logistics/deliveries/new" },
    { id: "suivi", href: "/logistics" },
    { id: "portal", href: "/suivi" },
    { id: "billing", href: BILLING_UPGRADE_HREF },
  ],
  education: [
    { id: "course", href: "/education/courses/new" },
    { id: "video", href: "/education" },
    { id: "portal", href: "/formation" },
    { id: "cert", href: "/education" },
    { id: "billing", href: BILLING_UPGRADE_HREF },
  ],
  blockchain: [
    { id: "asset", href: "/blockchain/assets/new" },
    { id: "trace", href: "/trace" },
    { id: "contract", href: "/blockchain/contracts" },
    { id: "billing", href: BILLING_UPGRADE_HREF },
  ],
};

function readProgress(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (raw) return JSON.parse(raw) as Record<string, boolean>;
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (!legacy) return {};
    const old = JSON.parse(legacy) as Record<string, boolean>;
    const migrated: Record<string, boolean> = {};
    if (old.product) migrated.product = true;
    if (old.sale) migrated.sale = true;
    if (old.logistics) migrated.client = true;
    if (old.education) migrated.billing = true;
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(migrated));
    return migrated;
  } catch {
    return {};
  }
}

export function getBusinessVertical(): BusinessVertical {
  if (typeof window === "undefined") return "commerce";
  const raw = localStorage.getItem(VERTICAL_KEY);
  if (raw && ALL_MODULE_IDS.includes(raw as ModuleId)) return raw as BusinessVertical;
  return "commerce";
}

export function setBusinessVertical(vertical: BusinessVertical) {
  if (typeof window === "undefined") return;
  localStorage.setItem(VERTICAL_KEY, vertical);
}

const VERTICAL_INFER_PRIORITY: ModuleId[] = [
  "agriculture",
  "health",
  "logistics",
  "education",
  "blockchain",
  "commerce",
];

export function inferVerticalFromModules(modules: ModuleId[]): BusinessVertical {
  for (const id of VERTICAL_INFER_PRIORITY) {
    if (modules.includes(id)) return id;
  }
  return "commerce";
}

export function getOnboardingTasks(vertical?: BusinessVertical): OnboardingTaskDef[] {
  const v = vertical ?? getBusinessVertical();
  return ONBOARDING_BY_VERTICAL[v];
}

export function setTaskDone(taskId: string, done: boolean) {
  if (typeof window === "undefined") return;
  const next = { ...readProgress(), [taskId]: done };
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
}

export function getOnboardingProgress(vertical?: BusinessVertical) {
  const tasks = getOnboardingTasks(vertical);
  const progress = readProgress();
  const done = tasks.filter((t) => progress[t.id]).length;
  return { tasks, progress, done, total: tasks.length };
}
