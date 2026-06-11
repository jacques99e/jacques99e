"use client";

import { useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { ModuleCard } from "@/components/ModuleCard";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/contexts/I18nContext";
import { useAuth } from "@/hooks/useAuth";
import { useModule } from "@/hooks/useModule";
import { useRole } from "@/hooks/useRole";
import { localStore } from "@/lib/db";
import { AllModulePortals } from "@/components/AllModulePortals";
import { ModuleStatGrid } from "@/components/ModuleStatGrid";
import { ALL_MODULE_IDS } from "@/lib/modules/config";
import { useModuleLabelFn } from "@/hooks/useModuleLabel";

export default function ModulesPage() {
  const { t } = useI18n();
  const moduleLabel = useModuleLabelFn();
  const { user } = useAuth();
  const { canManageModules, role } = useRole(user?.id);
  const store = localStore.get();
  const { modules, toggleModule, isEnabled } = useModule(store?.id);
  const [search, setSearch] = useState("");

  const filteredModuleIds = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ALL_MODULE_IDS;
    return ALL_MODULE_IDS.filter((id) => moduleLabel(id).toLowerCase().includes(q));
  }, [search, moduleLabel]);

  return (
    <>
      <AppHeader title={t("modules.title")} />
      <main className="app-page space-y-3 pb-6">
        <p className="text-sm text-gray-600 dark:text-gray-400">{t("modules.subtitle")}</p>
        <ModuleStatGrid
          items={[
            { value: modules.length, label: "Actifs" },
            { value: ALL_MODULE_IDS.length, label: "Disponibles" },
          ]}
        />
        <AllModulePortals />

        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un module"
        />
        {!canManageModules ? (
          <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-700">
            Rôle <strong>{role}</strong>: consultation uniquement. Seul le propriétaire peut activer/désactiver des modules.
          </p>
        ) : null}
        {filteredModuleIds.map((id) => (
          <ModuleCard
            key={id}
            moduleId={id}
            enabled={isEnabled(id)}
            onToggle={toggleModule}
            canToggle={canManageModules}
          />
        ))}
        {filteredModuleIds.length === 0 ? (
          <p className="rounded-xl bg-white p-3 text-xs text-gray-500 shadow-sm dark:bg-gray-800">
            Aucun module ne correspond à cette recherche.
          </p>
        ) : null}
        <p className="text-xs text-gray-400 pt-2">
          {t("modules.active")}: {modules.map((id) => moduleLabel(id)).join(", ")}
        </p>
      </main>
    </>
  );
}
