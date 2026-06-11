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
import { toolDescKey, toolTitleKey } from "@/lib/module-local-tools";
import { useI18n } from "@/contexts/I18nContext";
import type { ModuleId } from "@/types";

interface ToolItem {
  id: string;
  href: string;
  icon: LucideIcon;
}

const TOOLS_BY_MODULE: Record<ModuleId, ToolItem[]> = {
  commerce: [
    { id: "momo", href: "/sales", icon: Smartphone },
    { id: "vitrine", href: "/profile", icon: MessageCircle },
    { id: "whatsapp", href: "/products", icon: Package },
    { id: "credit", href: "/sales/credit", icon: CreditCard },
  ],
  agriculture: [
    { id: "marches", href: "/agriculture/marches", icon: TrendingUp },
    { id: "meteo", href: "/agriculture", icon: CloudSun },
    { id: "vente", href: "/products/add?category=Agriculture", icon: Package },
    { id: "calendrier", href: "/agriculture/calendrier", icon: Calendar },
  ],
  health: [
    { id: "rdv", href: "/health/appointments", icon: MessageCircle },
    { id: "patient", href: "/health", icon: Stethoscope },
    { id: "contacts", href: "/clients", icon: Stethoscope },
    { id: "pharmacie", href: "/health/pharmacie", icon: Pill },
  ],
  logistics: [
    { id: "track", href: "/suivi", icon: Truck },
    { id: "new", href: "/logistics/deliveries/new", icon: Truck },
    { id: "recipients", href: "/clients", icon: MessageCircle },
    { id: "tournee", href: "/logistics/tournee", icon: Map },
  ],
  education: [
    { id: "video", href: "/education", icon: Video },
    { id: "cert", href: "/education", icon: GraduationCap },
    { id: "portal", href: "/formation", icon: MessageCircle },
    { id: "presence", href: "/education/presence", icon: UserCheck },
  ],
  blockchain: [
    { id: "verify", href: "/trace", icon: Shield },
    { id: "asset", href: "/blockchain", icon: Shield },
    { id: "coop", href: "/blockchain/contracts", icon: Shield },
    { id: "qr", href: "/blockchain/qr", icon: QrCode },
  ],
};

export function ModuleAfricanTools({ moduleId }: { moduleId: ModuleId }) {
  const { t } = useI18n();
  const tools = TOOLS_BY_MODULE[moduleId];
  if (!tools?.length) return null;

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
        {t("africanTools.title")}
      </h2>
      <div className="grid gap-2">
        {tools.map((tool) => {
          const Icon = tool.icon;
          const titleKey = toolTitleKey(moduleId, tool.id);
          const descKey = toolDescKey(moduleId, tool.id);
          return (
            <Link
              key={tool.href + tool.id}
              href={tool.href}
              className="flex items-center gap-3 rounded-xl border border-[#075E54]/10 bg-white p-3 shadow-sm transition hover:border-[#075E54]/30 dark:bg-gray-800"
            >
              <div className="rounded-lg bg-[#075E54]/10 p-2">
                <Icon className="h-5 w-5 text-[#075E54]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{t(titleKey)}</p>
                <p className="text-xs text-gray-500">{t(descKey)}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
