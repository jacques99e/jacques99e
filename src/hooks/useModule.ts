"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { localModules } from "@/lib/db";
import { normalizeModuleIds, parseModuleIds } from "@/lib/modules/config";
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

    const profileIds = parseModuleIds(
      Array.isArray(profile?.active_modules) ? (profile.active_modules as string[]) : []
    );

    const [{ data: storeMods }, { data: storeRow }] = await Promise.all([
      supabase
        .from("store_modules")
        .select("module_id")
        .eq("store_id", storeId)
        .eq("enabled", true),
      supabase.from("stores").select("modules").eq("id", storeId).maybeSingle(),
    ]);

    const rowIds = parseModuleIds((storeMods || []).map((m) => m.module_id as string));
    const columnIds = parseModuleIds(
      Array.isArray(storeRow?.modules) ? (storeRow.modules as string[]) : []
    );
    const merged = parseModuleIds([...rowIds, ...columnIds, ...profileIds]);
    const union = merged.length ? merged : normalizeModuleIds(cached);
    const needsPersist = !sameModules(rowIds, union) || !sameModules(profileIds, union);

    if (needsPersist) {
      try {
        const res = await apiFetch("/api/stores/modules", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storeId,
            modules: union,
          }),
        });
        const data = (await res.json()) as { success?: boolean; modules?: string[] };
        if (res.ok && data.success && data.modules?.length) {
          applyLocal(normalizeModuleIds(data.modules));
          setLoading(false);
          return;
        }
      } catch {
        /* garde l'union locale */
      }
    }

    applyLocal(union);
    setLoading(false);
  }, [storeId, applyLocal]);

  useEffect(() => {
    void load();
  }, [load]);

  const setActiveModules = useCallback(
    async (ids: ModuleId[]) => {
      const previous = localModules.get();
      const unique = applyLocal(ids);

      if (!storeId || !navigator.onLine) return;

      try {
        const res = await apiFetch("/api/stores/modules", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storeId, modules: unique }),
        });
        const data = (await res.json()) as { success?: boolean; modules?: string[] };
        if (res.ok && data.success && data.modules?.length) {
          applyLocal(normalizeModuleIds(data.modules));
          return;
        }
      } catch {
        /* retour à l'état précédent */
      }
      applyLocal(previous);
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
