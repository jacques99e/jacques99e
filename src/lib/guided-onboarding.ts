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
      "Ajoutez vos produits, encaissez en Mobile Money, gérez le crédit client et partagez votre catalogue WhatsApp.",
    href: "/products/add",
    cta: "Ajouter un produit",
  },
  health: {
    title: "Santé & rendez-vous",
    description:
      "Créez un patient, gérez la mini pharmacie, planifiez un RDV et activez les rappels WhatsApp.",
    href: "/health/patients/new",
    cta: "Créer un patient",
  },
  agriculture: {
    title: "Agriculture",
    description:
      "Planifiez le calendrier cultural, notez les prix marchés et calculez le rendement avant la vente.",
    href: "/agriculture/parcels/new",
    cta: "Ajouter une parcelle",
  },
  logistics: {
    title: "Logistique",
    description:
      "Créez une livraison, organisez la tournée du jour et envoyez le lien /suivi par WhatsApp.",
    href: "/logistics/deliveries/new",
    cta: "Nouvelle livraison",
  },
  education: {
    title: "Formation",
    description:
      "Publiez un cours, enregistrez les présences et partagez le portail /formation à vos apprenants.",
    href: "/education/courses/new",
    cta: "Créer un cours",
  },
  blockchain: {
    title: "Traçabilité",
    description:
      "Enregistrez un actif, imprimez le QR sur vos étiquettes et partagez le lien /trace.",
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
