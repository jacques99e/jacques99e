import type { ModuleId } from "@/types";

export interface PremiumTool {
  id: string;
  moduleId: ModuleId;
  title: string;
  tagline: string;
  description: string;
  href: string;
  badge?: string;
}

/** Outils premium « jamais vus » — différenciation continentale Wazo. */
export const WAZO_PREMIUM_TOOLS: PremiumTool[] = [
  {
    id: "nexus",
    moduleId: "commerce",
    title: "Wazo Nexus",
    tagline: "Centre de commande IA",
    description: "Score santé business, signaux cross-modules et actions prioritaires",
    href: "/nexus",
    badge: "Hub",
  },
  {
    id: "voice",
    moduleId: "commerce",
    title: "Caisse Vocale",
    tagline: "Vendre à la voix",
    description: "Dictez vos ventes en français — idéal marché & boutique sans clavier",
    href: "/sales/voice",
    badge: "Voix",
  },
  {
    id: "tontine",
    moduleId: "commerce",
    title: "Tontine Digitale",
    tagline: "Épargne rotative",
    description: "Gérez votre tontine commerçants : cotisations, tour et rappels WhatsApp",
    href: "/sales/tontine",
    badge: "Afrique",
  },
  {
    id: "momo-links",
    moduleId: "commerce",
    title: "Liens MoMo",
    tagline: "Encaisser à distance",
    description: "Facture PayDunya LIVE — le client paie en 1 clic MoMo",
    href: "/sales/liens",
    badge: "MoMo",
  },
  {
    id: "radar",
    moduleId: "agriculture",
    title: "Agri Radar",
    tagline: "Alertes continentales",
    description: "Signaux prix marché, risques maladies et fenêtres de semis optimales",
    href: "/agriculture/radar",
    badge: "Radar",
  },
  {
    id: "sentinel",
    moduleId: "health",
    title: "Santé Sentinel",
    tagline: "Veille communautaire",
    description: "Calendrier vaccinal, alertes épidémiques et signalement communautaire",
    href: "/health/sentinel",
    badge: "Sentinel",
  },
  {
    id: "fleet",
    moduleId: "logistics",
    title: "Fleet Pulse",
    tagline: "Flotte intelligente",
    description: "Chauffeurs, affectation colis et estimation carburant FCFA/km",
    href: "/logistics/fleet",
    badge: "Fleet",
  },
  {
    id: "badges",
    moduleId: "education",
    title: "Micro-Badges",
    tagline: "Compétences vérifiables",
    description: "Badges empilables avec QR — reconnaissance employeur & bailleurs",
    href: "/education/badges",
    badge: "Skills",
  },
  {
    id: "passport",
    moduleId: "blockchain",
    title: "Passeport Produit",
    tagline: "Export UE & bailleurs",
    description: "Dossier d'origine numérique : GPS, lot, coopérative, story consommateur",
    href: "/blockchain/passport",
    badge: "Export",
  },
];

export function premiumToolsForModules(modules: ModuleId[]): PremiumTool[] {
  const active = new Set(modules);
  return WAZO_PREMIUM_TOOLS.filter(
    (t) => t.id === "nexus" || active.has(t.moduleId)
  );
}

export function premiumToolsForModule(moduleId: ModuleId): PremiumTool[] {
  return WAZO_PREMIUM_TOOLS.filter((t) => t.moduleId === moduleId);
}
