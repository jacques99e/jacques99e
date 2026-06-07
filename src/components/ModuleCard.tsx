"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { MODULES } from "@/lib/modules/config";
import { useI18n } from "@/contexts/I18nContext";
import type { ModuleId } from "@/types";

interface ModuleCardProps {
  moduleId: ModuleId;
  enabled: boolean;
  onToggle: (id: ModuleId) => void;
  canToggle?: boolean;
}

export function ModuleCard({ moduleId, enabled, onToggle, canToggle = true }: ModuleCardProps) {
  const { t } = useI18n();
  const config = MODULES[moduleId];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "app-card flex w-full items-center gap-3 border-2 p-4 transition-all dark:border-gray-700 dark:bg-gray-800",
        enabled ? "border-wazo-green/40 bg-wazo-green/5 shadow-wazo" : "border-transparent"
      )}
    >
      <div
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white",
          config.color
        )}
      >
        <Icon className="h-6 w-6" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold dark:text-white">{t(`modules.${moduleId}.title`)}</p>
        <p className="text-xs text-gray-500 line-clamp-2 dark:text-gray-400">
          {t(`modules.${moduleId}.desc`)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Link
          href={config.path}
          className="rounded-full bg-[#075E54] px-3 py-1.5 text-xs font-semibold text-white"
        >
          Ouvrir
        </Link>
        <button
          type="button"
          onClick={() => onToggle(moduleId)}
          aria-label={enabled ? "Désactiver le module" : "Activer le module"}
          disabled={!canToggle}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full border-2 transition",
            !canToggle ? "cursor-not-allowed opacity-50" : "",
            enabled
              ? "border-wazo-green bg-wazo-green text-white"
              : "border-gray-300 bg-white text-transparent"
          )}
        >
          <Check className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
