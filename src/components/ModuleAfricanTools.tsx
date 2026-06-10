"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  MessageCircle,
  Video,
  CloudSun,
  TrendingUp,
  Smartphone,
  Package,
  Stethoscope,
  Truck,
  Shield,
  GraduationCap,
  CreditCard,
  Calendar,
  Pill,
  Map,
  UserCheck,
  QrCode,
} from "lucide-react";
import type { ModuleId } from "@/types";

interface ToolItem {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
}

const TOOLS_BY_MODULE: Record<ModuleId, ToolItem[]> = {
  commerce: [
    {
      title: "Caisse & Mobile Money",
      description: "Orange, MTN, Moov, espèces — reçu WhatsApp",
      href: "/sales",
      icon: Smartphone,
    },
    {
      title: "Vitrine WhatsApp",
      description: "Partager votre boutique en ligne",
      href: "/profile",
      icon: MessageCircle,
    },
    {
      title: "Stock & alertes",
      description: "Produits, ruptures, seuils",
      href: "/products",
      icon: Package,
    },
    {
      title: "Carnet crédit",
      description: "Dettes clients + relance WhatsApp",
      href: "/sales/credit",
      icon: CreditCard,
    },
  ],
  agriculture: [
    {
      title: "Prix du marché",
      description: "Noter les prix locaux (marché, coopérative)",
      href: "/agriculture/marches",
      icon: TrendingUp,
    },
    {
      title: "Météo & conseils",
      description: "Alertes pluie et saison",
      href: "/agriculture",
      icon: CloudSun,
    },
    {
      title: "Vendre la récolte",
      description: "Mettre un produit en vente rapidement",
      href: "/products/add?category=Agriculture",
      icon: Package,
    },
    {
      title: "Calendrier cultural",
      description: "Semis, traitements et récolte",
      href: "/agriculture/calendrier",
      icon: Calendar,
    },
  ],
  health: [
    {
      title: "Rappels patients",
      description: "WhatsApp pour rendez-vous et suivi",
      href: "/health/appointments",
      icon: MessageCircle,
    },
    {
      title: "Dossier patient",
      description: "Constantes, ordonnances, historique",
      href: "/health",
      icon: Stethoscope,
    },
    {
      title: "Mini CRM contacts",
      description: "Familles et accompagnants",
      href: "/clients",
      icon: Stethoscope,
    },
    {
      title: "Mini pharmacie",
      description: "Stock médicaments et alertes",
      href: "/health/pharmacie",
      icon: Pill,
    },
  ],
  logistics: [
    {
      title: "Suivi livraison",
      description: "Code tracking + WhatsApp destinataire",
      href: "/suivi",
      icon: Truck,
    },
    {
      title: "Nouvelle livraison",
      description: "Colis, adresse, téléphone",
      href: "/logistics/deliveries/new",
      icon: Truck,
    },
    {
      title: "Clients livraison",
      description: "Destinataires récurrents",
      href: "/clients",
      icon: MessageCircle,
    },
    {
      title: "Tournée du jour",
      description: "Itinéraire + partage WhatsApp",
      href: "/logistics/tournee",
      icon: Map,
    },
  ],
  education: [
    {
      title: "Vidéos de cours",
      description: "YouTube, Vimeo ou fichier MP4",
      href: "/education",
      icon: Video,
    },
    {
      title: "Certificats PDF",
      description: "Délivrer après formation",
      href: "/education",
      icon: GraduationCap,
    },
    {
      title: "Portail formation",
      description: "Lien public /formation pour élèves",
      href: "/formation",
      icon: MessageCircle,
    },
    {
      title: "Feuille de présence",
      description: "Émargement + export PDF",
      href: "/education/presence",
      icon: UserCheck,
    },
  ],
  blockchain: [
    {
      title: "Vérification publique",
      description: "Portail /trace pour acheteurs",
      href: "/trace",
      icon: Shield,
    },
    {
      title: "Traçabilité actifs",
      description: "Coopérative, stock, certification",
      href: "/blockchain",
      icon: Shield,
    },
    {
      title: "Contrats numériques",
      description: "Accords producteurs / acheteurs",
      href: "/blockchain/contracts",
      icon: Shield,
    },
    {
      title: "Preuve d'origine",
      description: "Hash et grand livre",
      href: "/blockchain/assets/new",
      icon: Shield,
    },
    {
      title: "QR étiquettes",
      description: "Code scannable /trace",
      href: "/blockchain/qr",
      icon: QrCode,
    },
  ],
};

export function ModuleAfricanTools({ moduleId }: { moduleId: ModuleId }) {
  const tools = TOOLS_BY_MODULE[moduleId];
  if (!tools?.length) return null;

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
        Outils utiles en Afrique
      </h2>
      <div className="grid gap-2">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link
              key={tool.href + tool.title}
              href={tool.href}
              className="flex items-center gap-3 rounded-xl border border-[#075E54]/10 bg-white p-3 shadow-sm transition hover:border-[#075E54]/30 dark:bg-gray-800"
            >
              <div className="rounded-lg bg-[#075E54]/10 p-2">
                <Icon className="h-5 w-5 text-[#075E54]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{tool.title}</p>
                <p className="text-xs text-gray-500">{tool.description}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
