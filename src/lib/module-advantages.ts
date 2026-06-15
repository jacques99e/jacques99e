import type { ModuleId } from "@/types";

export interface ModuleAdvantage {
  id: string;
  href?: string;
}

/** Fonctionnalités différenciantes Wazo vs concurrents génériques. */
export const MODULE_ADVANTAGES: Record<ModuleId, ModuleAdvantage[]> = {
  commerce: [
    { id: "momo", href: "/sales" },
    { id: "promo", href: "/sales/promotions" },
    { id: "credit", href: "/sales/credit" },
    { id: "whatsapp", href: "/products" },
  ],
  agriculture: [
    { id: "journal", href: "/agriculture/journal" },
    { id: "meteo", href: "/agriculture" },
    { id: "calendrier", href: "/agriculture/calendrier" },
    { id: "marches", href: "/agriculture/marches" },
  ],
  health: [
    { id: "followups", href: "/health/followups" },
    { id: "rdv", href: "/health/appointments" },
    { id: "pharma", href: "/health/pharmacie" },
    { id: "dossier", href: "/health" },
  ],
  logistics: [
    { id: "zones", href: "/logistics/zones" },
    { id: "suivi", href: "/suivi" },
    { id: "tournee", href: "/logistics/tournee" },
    { id: "pod", href: "/logistics" },
  ],
  education: [
    { id: "video", href: "/education" },
    { id: "quiz", href: "/education" },
    { id: "portal", href: "/formation" },
    { id: "presence", href: "/education/presence" },
  ],
  blockchain: [
    { id: "origin", href: "/blockchain/origin" },
    { id: "trace", href: "/trace" },
    { id: "qr", href: "/blockchain/qr" },
    { id: "coop", href: "/blockchain/contracts" },
  ],
};

export function advantageTitleKey(moduleId: ModuleId, id: string): string {
  return `advantage.${moduleId}.${id}.title`;
}

export function advantageDescKey(moduleId: ModuleId, id: string): string {
  return `advantage.${moduleId}.${id}.desc`;
}

export function advantagesForModule(moduleId: ModuleId): ModuleAdvantage[] {
  return MODULE_ADVANTAGES[moduleId] ?? [];
}
