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
  { href: "/nexus", label: "Wazo Nexus (score & premium)" },
  { href: "/modules", label: "Gérer les modules" },
  { href: "/products", label: "Catalogue produits", modules: ["commerce"] },
  { href: "/sales", label: "Caisse & ventes", modules: ["commerce"] },
  { href: "/sales/credit", label: "Carnet crédit clients", modules: ["commerce"] },
  { href: "/sales/voice", label: "Caisse vocale", modules: ["commerce"] },
  { href: "/sales/tontine", label: "Tontine digitale", modules: ["commerce"] },
  { href: "/sales/liens", label: "Liens paiement MoMo", modules: ["commerce"] },
  { href: "/clients", label: "Mini CRM clients", modules: ["commerce"] },
  { href: "/health", label: "Module santé", modules: ["health"] },
  { href: "/health/pharmacie", label: "Mini pharmacie", modules: ["health"] },
  { href: "/health/sentinel", label: "Santé Sentinel", modules: ["health"] },
  { href: "/logistics", label: "Livraisons", modules: ["logistics"] },
  { href: "/logistics/tournee", label: "Tournée du jour", modules: ["logistics"] },
  { href: "/logistics/fleet", label: "Fleet Pulse", modules: ["logistics"] },
  { href: "/education", label: "Formation", modules: ["education"] },
  { href: "/education/presence", label: "Feuille de présence", modules: ["education"] },
  { href: "/education/badges", label: "Micro-badges", modules: ["education"] },
  { href: "/agriculture", label: "Agriculture", modules: ["agriculture"] },
  { href: "/agriculture/calendrier", label: "Calendrier cultural", modules: ["agriculture"] },
  { href: "/agriculture/radar", label: "Agri Radar", modules: ["agriculture"] },
  { href: "/blockchain", label: "Traçabilité", modules: ["blockchain"] },
  { href: "/blockchain/qr", label: "QR traçabilité", modules: ["blockchain"] },
  { href: "/blockchain/passport", label: "Passeport produit export", modules: ["blockchain"] },
  { href: "/settings", label: "Diagnostic technique" },
  { href: "/billing", label: "Abonnement" },
];

export const HELP_FAQ: HelpFaqItem[] = [
  {
    q: "Comment démarrer avec le commerce ?",
    a: "Ajoutez un produit, enregistrez une vente depuis la caisse, gérez les dettes clients dans le carnet crédit, puis partagez votre catalogue WhatsApp.",
    modules: ["commerce"],
  },
  {
    q: "Comment démarrer avec la santé ?",
    a: "Créez un patient, planifiez un RDV, gérez le stock médicaments dans la mini pharmacie, puis envoyez un rappel WhatsApp depuis le planning.",
    modules: ["health"],
  },
  {
    q: "Comment démarrer avec la logistique ?",
    a: "Créez une livraison, organisez la tournée du jour, puis partagez le lien /suivi au client par WhatsApp.",
    modules: ["logistics"],
  },
  {
    q: "Comment démarrer avec la formation ?",
    a: "Créez un cours, enregistrez les présences, puis partagez le portail /formation ou le code d'invitation.",
    modules: ["education"],
  },
  {
    q: "Comment démarrer avec l'agriculture ?",
    a: "Planifiez vos cultures dans le calendrier, notez les prix marchés, puis calculez votre rendement kg/ha.",
    modules: ["agriculture"],
  },
  {
    q: "Comment démarrer avec la traçabilité ?",
    a: "Enregistrez un actif avec hash GPS, générez un QR pour vos étiquettes, puis partagez le lien /trace.",
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
