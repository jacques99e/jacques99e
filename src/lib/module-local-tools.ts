import type { ModuleId } from "@/types";

export interface ModuleLocalTool {
  id: string;
  title: string;
  description: string;
  href: string;
  /** wa.me, tel:, ou chemin interne */
  external?: boolean;
}

export const MODULE_LOCAL_TOOLS: Record<ModuleId, ModuleLocalTool[]> = {
  commerce: [
    {
      id: "momo",
      title: "Encaisser Mobile Money",
      description: "Caisse avec Orange, MTN, Moov, espèces",
      href: "/sales",
    },
    {
      id: "whatsapp",
      title: "Catalogue WhatsApp",
      description: "Partager vos produits aux clients",
      href: "/products",
    },
    {
      id: "crm",
      title: "Relance clients",
      description: "SMS / WhatsApp depuis le mini CRM",
      href: "/clients",
    },
    {
      id: "vitrine",
      title: "Vitrine en ligne",
      description: "Lien boutique sans appli à installer",
      href: "/profile",
    },
  ],
  agriculture: [
    {
      id: "meteo",
      title: "Météo & conseils",
      description: "Alertes pluie et calendrier cultural",
      href: "/agriculture/cultures",
    },
    {
      id: "intrants",
      title: "Carnet intrants",
      description: "Engrais, semences, eau — suivi des coûts",
      href: "/agriculture/intrants",
    },
    {
      id: "marches",
      title: "Prix marchés",
      description: "Cacao, café, maïs — prix indicatifs CI",
      href: "/agriculture/marches",
    },
    {
      id: "rendement",
      title: "Calcul rendement",
      description: "kg/ha et estimation revenus",
      href: "/agriculture/rendement",
    },
    {
      id: "vente",
      title: "Vendre la récolte",
      description: "Mettre la récolte en vente rapidement",
      href: "/products/add?category=Agriculture",
    },
  ],
  health: [
    {
      id: "patient",
      title: "Dossier patient",
      description: "Antécédents, groupe sanguin, allergies",
      href: "/health/patients/new",
    },
    {
      id: "rdv",
      title: "Rendez-vous",
      description: "Planning consultations",
      href: "/health/appointments/new",
    },
    {
      id: "ordonnance",
      title: "Ordonnance PDF",
      description: "Document à imprimer ou envoyer",
      href: "/health",
    },
    {
      id: "teleconsult",
      title: "Téléconsultation",
      description: "Appel / WhatsApp avec le patient",
      href: "/clients",
    },
  ],
  logistics: [
    {
      id: "new",
      title: "Nouvelle livraison",
      description: "Code suivi + destinataire",
      href: "/logistics/deliveries/new",
    },
    {
      id: "track",
      title: "Portail suivi client",
      description: "Lien public pour le destinataire",
      href: "/suivi",
    },
    {
      id: "pod",
      title: "Preuve de livraison",
      description: "Signature et photo à la réception",
      href: "/logistics",
    },
    {
      id: "cod",
      title: "Paiement à la livraison",
      description: "Encaissement MoMo à la remise",
      href: "/sales",
    },
  ],
  education: [
    {
      id: "video",
      title: "Cours avec vidéos",
      description: "YouTube ou fichier — faible consommation data",
      href: "/education",
    },
    {
      id: "cert",
      title: "Certificats PDF",
      description: "Attestation de fin de formation",
      href: "/education",
    },
    {
      id: "portal",
      title: "Portail formation",
      description: "Lien public /formation pour apprenants",
      href: "/formation",
    },
    {
      id: "invite",
      title: "Code invitation",
      description: "Inscrire des apprenants par lien",
      href: "/education/courses/new",
    },
    {
      id: "offline",
      title: "Mode hors ligne",
      description: "Contenus texte disponibles sans réseau",
      href: "/education",
    },
  ],
  blockchain: [
    {
      id: "asset",
      title: "Traçabilité produit",
      description: "Enregistrer origine et lot",
      href: "/blockchain/assets/new",
    },
    {
      id: "coop",
      title: "Contrat coopérative",
      description: "Accords producteurs / acheteurs",
      href: "/blockchain/contracts",
    },
    {
      id: "verify",
      title: "Vérification publique",
      description: "Portail /trace pour acheteurs",
      href: "/trace",
    },
    {
      id: "ledger",
      title: "Registre vérifiable",
      description: "Historique infalsifiable",
      href: "/blockchain",
    },
    {
      id: "export",
      title: "Export conformité",
      description: "Preuves pour bailleurs ou export",
      href: "/blockchain",
    },
  ],
};

export function buildWhatsAppShareUrl(text: string, phone?: string): string {
  const base = phone
    ? `https://wa.me/${phone.replace(/\D/g, "")}`
    : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(text)}`;
}
