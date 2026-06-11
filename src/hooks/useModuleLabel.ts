import { useCallback } from "react";
import { useI18n } from "@/contexts/I18nContext";
import type { ModuleId } from "@/types";

/** Libellé module traduit selon la langue active. */
export function useModuleLabel(moduleId: ModuleId): string {
  const { t } = useI18n();
  return t(`modules.${moduleId}.title`);
}

export function useModuleLabelFn() {
  const { t } = useI18n();
  return useCallback((moduleId: ModuleId) => t(`modules.${moduleId}.title`), [t]);
}
