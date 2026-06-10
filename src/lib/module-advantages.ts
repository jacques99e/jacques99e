import type { ModuleId } from "@/types";

export interface ModuleAdvantage {
  id: string;
  title: string;
  description: string;
  href?: string;
}

/** Fonctionnalités différenciantes Wazo vs concurrents génériques. */
export const MODULE_ADVANTAGES: Record<ModuleId, ModuleAdvantage[]> = {
  commerce: [
    {
      id: "momo",
      title: "Mobile Money natif",
      description: "Orange, MTN, Moov et espèces — reçu WhatsApp automatique",
      href: "/sales",
    },
    {
      id: "credit",
      title: "Carnet crédit client",
      description: "Dettes et acomptes avec relance WhatsApp",
      href: "/sales/credit",
    },
    {
      id: "offline",
      title: "Caisse hors ligne",
      description: "Ventes enregistrées localement, sync au retour réseau",
    },
    {
      id: "whatsapp",
      title: "Catalogue WhatsApp",
      description: "Liste de prix partageable en 1 clic",
      href: "/products",
    },
  ],
  agriculture: [
    {
      id: "meteo",
      title: "Météo GPS + conseils",
      description: "Alertes pluie et astuces culture adaptées",
      href: "/agriculture",
    },
    {
      id: "calendrier",
      title: "Calendrier cultural",
      description: "Semis, traitements et récolte par culture",
      href: "/agriculture/calendrier",
    },
    {
      id: "marches",
      title: "Prix marchés locaux",
      description: "Comparaison coopérative vs marché",
      href: "/agriculture/marches",
    },
    {
      id: "rendement",
      title: "Rendement & revenus",
      description: "kg/ha et estimation vente récolte",
      href: "/agriculture/rendement",
    },
  ],
  health: [
    {
      id: "rdv",
      title: "RDV du jour + rappels",
      description: "WhatsApp et SMS depuis le planning",
      href: "/health/appointments",
    },
    {
      id: "pharma",
      title: "Mini pharmacie",
      description: "Stock médicaments et alertes rupture",
      href: "/health/pharmacie",
    },
    {
      id: "dossier",
      title: "Dossier patient complet",
      description: "Groupe sanguin, allergies, ordonnances PDF",
      href: "/health",
    },
    {
      id: "tele",
      title: "Téléconsultation",
      description: "Lien WhatsApp direct depuis la fiche patient",
      href: "/clients",
    },
  ],
  logistics: [
    {
      id: "suivi",
      title: "Portail suivi public",
      description: "Lien /suivi sans compte pour le destinataire",
      href: "/suivi",
    },
    {
      id: "tournee",
      title: "Tournée du jour",
      description: "Itinéraire optimisé et partage groupé WhatsApp",
      href: "/logistics/tournee",
    },
    {
      id: "cod",
      title: "Paiement à la livraison",
      description: "Encaissement MoMo à la remise du colis",
      href: "/sales",
    },
    {
      id: "pod",
      title: "Preuve de livraison",
      description: "Signature et photo à la réception",
      href: "/logistics",
    },
  ],
  education: [
    {
      id: "portal",
      title: "Portail /formation",
      description: "Accès apprenants sans installation d'appli",
      href: "/formation",
    },
    {
      id: "presence",
      title: "Feuille de présence",
      description: "Émargement par cours avec export PDF",
      href: "/education/presence",
    },
    {
      id: "offline",
      title: "Cours hors ligne",
      description: "Contenus texte disponibles sans réseau",
      href: "/education",
    },
    {
      id: "cert",
      title: "Certificats PDF",
      description: "Attestation avec QR vérifiable",
      href: "/education",
    },
  ],
  blockchain: [
    {
      id: "trace",
      title: "Vérification /trace",
      description: "Portail public pour acheteurs et bailleurs",
      href: "/trace",
    },
    {
      id: "qr",
      title: "QR sur étiquettes",
      description: "Code scannable pour preuve d'origine",
      href: "/blockchain/qr",
    },
    {
      id: "gps",
      title: "Hash GPS infalsifiable",
      description: "Origine géolocalisée à l'enregistrement",
      href: "/blockchain/assets/new",
    },
    {
      id: "coop",
      title: "Contrats coopérative",
      description: "Accords producteurs / acheteurs numériques",
      href: "/blockchain/contracts",
    },
  ],
};

export function advantagesForModule(moduleId: ModuleId): ModuleAdvantage[] {
  return MODULE_ADVANTAGES[moduleId] ?? [];
}
