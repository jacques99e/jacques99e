import type { BillingPlanId } from "@/lib/billing";

/** Aligné sur lib/vitrine-data.ts (Landing) — libellés et promesses affichés dans l'app. */
export type VitrinePlanId = "free" | "pro" | "business";

export interface VitrinePlanDisplay {
  vitrineId: VitrinePlanId;
  billingId: BillingPlanId;
  title: string;
  subtitle: string;
  priceLabel: string;
  priceSuffix: string;
  hook: string;
  features: string[];
  popular: boolean;
  /** Mise en avant secondaire (équipes / multi-sites). */
  teamsPick?: boolean;
  badge?: string;
  cta: string;
  paymentFcfa: number;
}

export const VITRINE_PLANS: VitrinePlanDisplay[] = [
  {
    vitrineId: "free",
    billingId: "starter",
    title: "GRATUIT",
    subtitle: "Pour tester sans risque",
    priceLabel: "0 €",
    priceSuffix: "/mois",
    hook: "Idéal pour découvrir l'app",
    features: [
      "50 produits",
      "1 boutique",
      "Vitrine en ligne",
      "Mode hors ligne",
      "Tous les modules",
    ],
    popular: false,
    cta: "Rester sur le gratuit",
    paymentFcfa: 0,
  },
  {
    vitrineId: "pro",
    billingId: "pro",
    title: "PRO",
    subtitle: "Le choix des commerçants actifs",
    priceLabel: "9,99 €",
    priceSuffix: "/mois",
    hook: "≈ 33 centimes par jour",
    features: [
      "Produits illimités",
      "3 boutiques",
      "Analytics & exports PDF",
      "Support prioritaire",
      "Sans engagement",
    ],
    popular: true,
    cta: "Choisir PRO — je m'abonne",
    paymentFcfa: 6550,
  },
  {
    vitrineId: "business",
    billingId: "business",
    title: "BUSINESS",
    subtitle: "Pour équipes & multi-sites",
    priceLabel: "24,99 €",
    priceSuffix: "/mois",
    hook: "ROI dès 2 employés",
    features: [
      "Tout illimité",
      "10 boutiques",
      "Équipe & rôles",
      "Rapports hebdo par email",
      "Onboarding dédié",
    ],
    popular: false,
    teamsPick: true,
    badge: "Équipes & multi-sites",
    cta: "Passer au BUSINESS",
    paymentFcfa: 16350,
  },
];

export const VITRINE_HERO = {
  title: "Encaissez plus. Perdez moins de temps.",
  subtitle:
    "Caisse MoMo, stock, crédit clients, livraisons et boutique WhatsApp — une seule app pensée pour l'Afrique.",
  reassurance: "Sans carte bancaire · Gratuit pour toujours · Upgrade PRO en 1 clic",
} as const;

export function mapVitrinePlanToBilling(plan: string | null | undefined): BillingPlanId | null {
  if (!plan) return null;
  const normalized = plan.toLowerCase();
  if (normalized === "free" || normalized === "gratuit" || normalized === "starter") return "starter";
  if (normalized === "pro") return "pro";
  if (normalized === "business") return "business";
  return null;
}

export function vitrinePlanByBillingId(billingId: BillingPlanId): VitrinePlanDisplay {
  return VITRINE_PLANS.find((p) => p.billingId === billingId) ?? VITRINE_PLANS[0];
}

export function paymentFcfaForPlan(billingId: BillingPlanId): number {
  return vitrinePlanByBillingId(billingId).paymentFcfa;
}
