"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { localModules } from "@/lib/db";
import { normalizeModuleIds } from "@/lib/modules/config";
import type { ModuleId } from "@/types";

export function useModule(storeId?: string) {
  const [modules, setModules] = useState<ModuleId[]>(() => localModules.get());
  const [primaryModule, setPrimaryModule] = useState<ModuleId>(modules[0] ?? "commerce");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const cached = localModules.get();
    setModules(cached);
    setPrimaryModule(cached[0] ?? "commerce");

    if (!storeId || !navigator.onLine) {
      setLoading(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = user
      ? await supabase.from("profiles").select("active_modules").eq("id", user.id).maybeSingle()
      : { data: null };

    if (profile?.active_modules?.length) {
      const ids = normalizeModuleIds(profile.active_modules as string[]);
      localModules.save(ids);
      setModules(ids);
      setPrimaryModule(ids[0]);
    }

    const { data: storeMods } = await supabase
      .from("store_modules")
      .select("module_id")
      .eq("store_id", storeId)
      .eq("enabled", true);

    if (storeMods?.length) {
      const ids = normalizeModuleIds(storeMods.map((m) => m.module_id as string));
      localModules.save(ids);
      setModules(ids);
      setPrimaryModule(ids[0]);
    }

    setLoading(false);
  }, [storeId]);

  useEffect(() => {
    load();
  }, [load]);

  const setActiveModules = useCallback(
    async (ids: ModuleId[]) => {
      const unique = normalizeModuleIds(ids);
      localModules.save(unique);
      setModules(unique);
      setPrimaryModule(unique[0]);

      if (!storeId || !navigator.onLine) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("profiles").update({ active_modules: unique }).eq("id", user.id);
      }

      await supabase.from("store_modules").delete().eq("store_id", storeId);
      if (unique.length) {
        await supabase.from("store_modules").insert(
          unique.map((module_id) => ({ store_id: storeId, module_id, enabled: true }))
        );
      }
    },
    [storeId]
  );

  const toggleModule = useCallback(
    async (id: ModuleId) => {
      const next = modules.includes(id)
        ? modules.filter((m) => m !== id)
        : [...modules, id];
      if (next.length === 0) next.push("commerce");
      await setActiveModules(next);
    },
    [modules, setActiveModules]
  );

  const isEnabled = useCallback((id: ModuleId) => modules.includes(id), [modules]);

  return {
    modules,
    primaryModule,
    loading,
    setActiveModules,
    toggleModule,
    isEnabled,
    setPrimaryModule,
    reload: load,
  };
}
