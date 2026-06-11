import type { ModuleId } from "@/types";

export interface ModuleAdvantage {
  id: string;
  href?: string;
}

/** Fonctionnalités différenciantes Wazo vs concurrents génériques. */
export const MODULE_ADVANTAGES: Record<ModuleId, ModuleAdvantage[]> = {
  commerce: [
    { id: "momo", href: "/sales" },
    { id: "credit", href: "/sales/credit" },
    { id: "offline" },
    { id: "whatsapp", href: "/products" },
  ],
  agriculture: [
    { id: "meteo", href: "/agriculture" },
    { id: "calendrier", href: "/agriculture/calendrier" },
    { id: "marches", href: "/agriculture/marches" },
    { id: "rendement", href: "/agriculture/rendement" },
  ],
  health: [
    { id: "rdv", href: "/health/appointments" },
    { id: "pharma", href: "/health/pharmacie" },
    { id: "dossier", href: "/health" },
    { id: "tele", href: "/clients" },
  ],
  logistics: [
    { id: "suivi", href: "/suivi" },
    { id: "tournee", href: "/logistics/tournee" },
    { id: "cod", href: "/sales" },
    { id: "pod", href: "/logistics" },
  ],
  education: [
    { id: "portal", href: "/formation" },
    { id: "presence", href: "/education/presence" },
    { id: "offline", href: "/education" },
    { id: "cert", href: "/education" },
  ],
  blockchain: [
    { id: "trace", href: "/trace" },
    { id: "qr", href: "/blockchain/qr" },
    { id: "gps", href: "/blockchain/assets/new" },
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
