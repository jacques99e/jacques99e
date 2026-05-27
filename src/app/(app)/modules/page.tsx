"use client";

import { AppHeader } from "@/components/AppHeader";
import { ModuleCard } from "@/components/ModuleCard";
import { useI18n } from "@/contexts/I18nContext";
import { useModule } from "@/hooks/useModule";
import { localStore } from "@/lib/db";
import { ALL_MODULE_IDS } from "@/lib/modules/config";

export default function ModulesPage() {
  const { t } = useI18n();
  const store = localStore.get();
  const { modules, toggleModule, isEnabled } = useModule(store?.id);

  return (
    <>
      <AppHeader title={t("modules.title")} />
      <main className="mx-auto max-w-lg space-y-3 p-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">{t("modules.subtitle")}</p>
        {ALL_MODULE_IDS.map((id) => (
          <ModuleCard
            key={id}
            moduleId={id}
            enabled={isEnabled(id)}
            onToggle={toggleModule}
          />
        ))}
        <p className="text-xs text-gray-400 pt-2">
          {t("modules.active")}: {modules.join(", ")}
        </p>
      </main>
    </>
  );
}
