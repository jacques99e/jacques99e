"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { localModules } from "@/lib/db";
import { normalizeModuleIds } from "@/lib/modules/config";
import { apiFetch } from "@/lib/api-client";
import type { ModuleId } from "@/types";

function sameModules(a: ModuleId[], b: ModuleId[]) {
  if (a.length !== b.length) return false;
  const sa = [...a].sort().join(",");
  const sb = [...b].sort().join(",");
  return sa === sb;
}

export function useModule(storeId?: string) {
  const [modules, setModules] = useState<ModuleId[]>(() => localModules.get());
  const [primaryModule, setPrimaryModule] = useState<ModuleId>(modules[0] ?? "commerce");
  const [loading, setLoading] = useState(true);

  const applyLocal = useCallback((ids: ModuleId[]) => {
    const unique = normalizeModuleIds(ids);
    localModules.save(unique);
    setModules(unique);
    setPrimaryModule(unique[0] ?? "commerce");
    return unique;
  }, []);

  const load = useCallback(async () => {
    const cached = localModules.get();
    applyLocal(cached);

    if (!storeId || !navigator.onLine) {
      setLoading(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: profile } = user
      ? await supabase.from("profiles").select("active_modules").eq("id", user.id).maybeSingle()
      : { data: null };

    const profileIds = normalizeModuleIds(
      Array.isArray(profile?.active_modules) ? (profile!.active_modules as string[]) : []
    );

    const { data: storeMods } = await supabase
      .from("store_modules")
      .select("module_id")
      .eq("store_id", storeId)
      .eq("enabled", true);

    const storeIds = normalizeModuleIds(
      (storeMods || []).map((m) => m.module_id as string)
    );

    // Union : on ne perd plus les modules cochés à l'inscription.
    const union = normalizeModuleIds([...storeIds, ...profileIds]);
    const needsPersist =
      !storeIds.length ||
      !sameModules(storeIds, union) ||
      (profileIds.length > 0 && !sameModules(profileIds, union));

    if (needsPersist && union.length) {
      try {
        const res = await apiFetch("/api/stores/modules", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storeId,
            modules: union,
            syncFromProfile: true,
          }),
        });
        const data = (await res.json()) as { success?: boolean; modules?: string[] };
        if (res.ok && data.success && data.modules?.length) {
          applyLocal(data.modules);
          setLoading(false);
          return;
        }
      } catch {
        /* fallback local below */
      }
    }

    applyLocal(union.length ? union : storeIds.length ? storeIds : profileIds.length ? profileIds : cached);
    setLoading(false);
  }, [storeId, applyLocal]);

  useEffect(() => {
    void load();
  }, [load]);

  const setActiveModules = useCallback(
    async (ids: ModuleId[]) => {
      const unique = applyLocal(ids);

      if (!storeId || !navigator.onLine) return;

      try {
        const res = await apiFetch("/api/stores/modules", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storeId, modules: unique }),
        });
        if (res.ok) return;
      } catch {
        /* fallback client */
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("profiles").update({ active_modules: unique }).eq("id", user.id);
      }
      await supabase.from("store_modules").delete().eq("store_id", storeId);
      if (unique.length) {
        await supabase.from("store_modules").insert(
          unique.map((module_id) => ({ store_id: storeId, module_id, enabled: true }))
        );
      }
      await supabase.from("stores").update({ modules: unique }).eq("id", storeId);
    },
    [storeId, applyLocal]
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
