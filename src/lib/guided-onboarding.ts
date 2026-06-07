import { ALL_MODULE_IDS } from "@/lib/modules/config";
import type { ModuleId } from "@/types";

export interface GuidedStep {
  title: string;
  description: string;
  href: string;
  cta: string;
}

const GUIDED_DONE_KEY = "wazo_guided_onboarding_done";

export const GUIDED_STEPS_BY_MODULE: Record<ModuleId, GuidedStep> = {
  commerce: {
    title: "Commerce & caisse",
    description:
      "Ajoutez vos produits, enregistrez une vente et partagez votre catalogue WhatsApp en quelques minutes.",
    href: "/products/add",
    cta: "Ajouter un produit",
  },
  health: {
    title: "Santé & rendez-vous",
    description:
      "Créez un patient, planifiez un RDV et activez les rappels pour ne plus manquer une consultation.",
    href: "/health/patients/new",
    cta: "Créer un patient",
  },
  agriculture: {
    title: "Agriculture",
    description:
      "Notez vos parcelles, les prix du marché et calculez le rendement avant de vendre la récolte.",
    href: "/agriculture/parcels/new",
    cta: "Ajouter une parcelle",
  },
  logistics: {
    title: "Logistique",
    description:
      "Créez une livraison, envoyez le lien de suivi au client et testez le portail public /suivi.",
    href: "/logistics/deliveries/new",
    cta: "Nouvelle livraison",
  },
  education: {
    title: "Formation",
    description:
      "Publiez un cours, ajoutez une leçon vidéo et partagez le portail /formation à vos apprenants.",
    href: "/education/courses/new",
    cta: "Créer un cours",
  },
  blockchain: {
    title: "Traçabilité",
    description:
      "Enregistrez un actif, générez un lien /trace et partagez la preuve d'origine à vos partenaires.",
    href: "/blockchain/assets/new",
    cta: "Enregistrer un actif",
  },
};

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
