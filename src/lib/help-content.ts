import { MODULE_LABELS } from "@/lib/modules/config";
import type { ModuleId } from "@/types";

export interface HelpLink {
  href: string;
  label: string;
  modules?: ModuleId[];
}

export interface HelpFaqItem {
  q: string;
  a: string;
  modules?: ModuleId[];
}

export const HELP_LINKS: HelpLink[] = [
  { href: "/dashboard", label: "Tableau de bord" },
  { href: "/modules", label: "Gérer les modules" },
  { href: "/products", label: "Catalogue produits", modules: ["commerce"] },
  { href: "/sales", label: "Caisse & ventes", modules: ["commerce"] },
  { href: "/clients", label: "Mini CRM clients", modules: ["commerce"] },
  { href: "/health", label: "Module santé", modules: ["health"] },
  { href: "/logistics", label: "Livraisons", modules: ["logistics"] },
  { href: "/education", label: "Formation", modules: ["education"] },
  { href: "/agriculture", label: "Agriculture", modules: ["agriculture"] },
  { href: "/blockchain", label: "Traçabilité", modules: ["blockchain"] },
  { href: "/settings", label: "Diagnostic technique" },
  { href: "/billing", label: "Abonnement" },
];

export const HELP_FAQ: HelpFaqItem[] = [
  {
    q: "Comment démarrer avec le commerce ?",
    a: "Ajoutez un produit, enregistrez une vente depuis la caisse, puis partagez votre catalogue WhatsApp ou le lien boutique publique.",
    modules: ["commerce"],
  },
  {
    q: "Comment démarrer avec la santé ?",
    a: "Créez un premier patient, planifiez un rendez-vous, puis envoyez un rappel WhatsApp ou SMS depuis la liste des RDV.",
    modules: ["health"],
  },
  {
    q: "Comment démarrer avec la logistique ?",
    a: "Créez une livraison avec code de suivi, puis partagez le lien /suivi au client pour qu'il suive son colis.",
    modules: ["logistics"],
  },
  {
    q: "Comment démarrer avec la formation ?",
    a: "Créez un cours, ajoutez des leçons, puis partagez le code d'invitation ou le portail /formation.",
    modules: ["education"],
  },
  {
    q: "Comment démarrer avec l'agriculture ?",
    a: "Enregistrez une parcelle, notez les prix du marché local, puis calculez votre rendement kg/ha.",
    modules: ["agriculture"],
  },
  {
    q: "Comment démarrer avec la traçabilité ?",
    a: "Enregistrez un actif avec hash GPS, puis partagez le lien /trace pour vérification publique.",
    modules: ["blockchain"],
  },
  {
    q: "Que faire si je suis hors ligne ?",
    a: "Continuez à travailler normalement. Les données locales sont conservées et se synchronisent dès le retour de connexion.",
  },
  {
    q: "Comment exporter mes données ?",
    a: "Chaque module propose des exports CSV/PDF depuis ses écrans liste. Le rapport hebdomadaire est disponible depuis le tableau de bord.",
  },
  {
    q: "Comment changer mes modules actifs ?",
    a: "Allez dans Modules depuis le tableau de bord. Seul le propriétaire peut activer ou désactiver des modules.",
  },
  {
    q: "Comment gérer les droits d'accès ?",
    a: "Les rôles sont appliqués automatiquement. Le propriétaire garde les actions sensibles et les diagnostics.",
  },
];

export function helpLinksForModules(activeModules: ModuleId[]): HelpLink[] {
  return HELP_LINKS.filter(
    (link) => !link.modules || link.modules.some((id) => activeModules.includes(id))
  );
}

export function helpFaqForModules(activeModules: ModuleId[]): HelpFaqItem[] {
  const moduleSpecific = HELP_FAQ.filter(
    (item) => item.modules && item.modules.some((id) => activeModules.includes(id))
  );
  const general = HELP_FAQ.filter((item) => !item.modules);
  return [...moduleSpecific.slice(0, 3), ...general];
}

export function helpWelcomeLine(activeModules: ModuleId[]): string {
  if (activeModules.length === 1) {
    return `Aide pour votre module ${MODULE_LABELS[activeModules[0]]}.`;
  }
  return `Aide adaptée à vos ${activeModules.length} modules actifs.`;
}
