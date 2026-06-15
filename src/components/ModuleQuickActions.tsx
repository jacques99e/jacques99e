"use client";

import Link from "next/link";
import { MODULES } from "@/lib/modules/config";
import { useModuleLabelFn } from "@/hooks/useModuleLabel";
import type { ModuleId } from "@/types";

/** Raccourcis d'action par module actif — visible sur tous les profils d'activité. */
const EXTRA_ACTIONS: Partial<Record<ModuleId, { href: string; label: string }[]>> = {
  commerce: [
    { href: "/sales/promotions", label: "Promo" },
    { href: "/clients", label: "Clients" },
  ],
  agriculture: [{ href: "/agriculture/journal", label: "Journal" }],
  health: [{ href: "/health/followups", label: "Rappels" }],
  logistics: [{ href: "/logistics/zones", label: "Zones" }],
  education: [{ href: "/formation", label: "Portail" }],
  blockchain: [{ href: "/blockchain/origin", label: "Certificat" }],
};

interface ModuleQuickActionsProps {
  activeModules: ModuleId[];
}

export function ModuleQuickActions({ activeModules }: ModuleQuickActionsProps) {
  const label = useModuleLabelFn();

  if (!activeModules.length) return null;

  return (
    <section className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-gray-100">
      <p className="mb-2 text-xs font-semibold text-gray-600">Actions rapides</p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {activeModules.map((moduleId) => {
          const config = MODULES[moduleId];
          const Icon = config.icon;
          const extras = EXTRA_ACTIONS[moduleId] ?? [];
          return (
            <div key={moduleId} className="flex shrink-0 gap-2">
              <Link
                href={config.addPath ?? config.path}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-white ${config.color}`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label(moduleId)}
              </Link>
              {extras.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="shrink-0 rounded-xl bg-gray-100 px-3 py-2 text-xs font-medium text-gray-800"
                >
                  {action.label}
                </Link>
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}
