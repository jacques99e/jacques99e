"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { MODULES } from "@/lib/modules/config";
import { useI18n } from "@/contexts/I18nContext";
import type { ModuleId } from "@/types";

interface ModuleCardProps {
  moduleId: ModuleId;
  enabled: boolean;
  onToggle: (id: ModuleId) => void;
}

export function ModuleCard({ moduleId, enabled, onToggle }: ModuleCardProps) {
  const { t } = useI18n();
  const config = MODULES[moduleId];
  const Icon = config.icon;

  return (
    <button
      type="button"
      onClick={() => onToggle(moduleId)}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border-2 p-4 text-left transition-colors dark:border-gray-700 dark:bg-gray-800",
        enabled ? "border-wazo-green bg-wazo-green/5" : "border-gray-200 bg-white"
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
      {enabled && (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-wazo-green text-white">
          <Check className="h-4 w-4" />
        </span>
      )}
    </button>
  );
}
