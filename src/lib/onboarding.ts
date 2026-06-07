import { ALL_MODULE_IDS } from "@/lib/modules/config";
import type { ModuleId } from "@/types";

/** Secteur d'activité = module principal pour l'onboarding métier */
export type BusinessVertical = ModuleId;

export interface OnboardingTaskDef {
  id: string;
  label: string;
  href: string;
}

const VERTICAL_KEY = "wazo_business_vertical";
const PROGRESS_KEY = "wazo_onboarding_progress";
const LEGACY_KEY = "wazo_onboarding_tasks";

export const BUSINESS_VERTICAL_LABELS: Record<BusinessVertical, string> = {
  commerce: "Commerce & vente",
  health: "Santé & soins",
  agriculture: "Agriculture & récolte",
  logistics: "Logistique & livraisons",
  education: "Éducation & formation",
  blockchain: "Blockchain & traçabilité",
};

export const ONBOARDING_VERTICAL_ORDER: BusinessVertical[] = ALL_MODULE_IDS;

export const ONBOARDING_BY_VERTICAL: Record<BusinessVertical, OnboardingTaskDef[]> = {
  commerce: [
    { id: "product", label: "Ajouter un premier produit", href: "/products/add" },
    { id: "sale", label: "Enregistrer une première vente", href: "/sales" },
    { id: "catalog", label: "Partager le catalogue WhatsApp", href: "/products" },
    { id: "vitrine", label: "Copier le lien boutique publique", href: "/profile" },
    { id: "billing", label: "Configurer l'abonnement", href: "/billing" },
  ],
  health: [
    { id: "patient", label: "Créer un premier patient", href: "/health/patients/new" },
    { id: "appointment", label: "Planifier un rendez-vous", href: "/health/appointments/new" },
    { id: "remind", label: "Envoyer un rappel WhatsApp ou SMS", href: "/health/appointments" },
    { id: "billing", label: "Configurer l'abonnement", href: "/billing" },
  ],
  agriculture: [
    { id: "parcel", label: "Enregistrer une parcelle", href: "/agriculture/parcels/new" },
    { id: "marches", label: "Noter les prix du marché local", href: "/agriculture/marches" },
    { id: "rendement", label: "Calculer le rendement kg/ha", href: "/agriculture/rendement" },
    { id: "sale", label: "Vendre la récolte", href: "/products/add?category=Agriculture" },
    { id: "billing", label: "Configurer l'abonnement", href: "/billing" },
  ],
  logistics: [
    { id: "delivery", label: "Créer une première livraison", href: "/logistics/deliveries/new" },
    { id: "suivi", label: "Envoyer le lien suivi au client", href: "/logistics" },
    { id: "portal", label: "Tester le portail public /suivi", href: "/suivi" },
    { id: "billing", label: "Configurer l'abonnement", href: "/billing" },
  ],
  education: [
    { id: "course", label: "Créer un premier cours public", href: "/education/courses/new" },
    { id: "video", label: "Ajouter une leçon vidéo", href: "/education" },
    { id: "portal", label: "Partager le portail /formation", href: "/formation" },
    { id: "cert", label: "Certificat QR à 100 %", href: "/education" },
    { id: "billing", label: "Configurer l'abonnement", href: "/billing" },
  ],
  blockchain: [
    { id: "asset", label: "Enregistrer un premier actif", href: "/blockchain/assets/new" },
    { id: "trace", label: "Partager le lien /trace", href: "/trace" },
    { id: "contract", label: "Créer un contrat numérique", href: "/blockchain/contracts" },
    { id: "billing", label: "Configurer l'abonnement", href: "/billing" },
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

export function isTaskDone(taskId: string): boolean {
  return Boolean(readProgress()[taskId]);
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
