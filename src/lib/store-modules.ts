import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeModuleIds } from "@/lib/modules/config";
import type { ModuleId } from "@/types";

/** Enregistre les modules sur la boutique, le profil et les lignes activées. */
export async function persistStoreModules(
  db: SupabaseClient,
  storeId: string,
  userId: string,
  modules: string[]
): Promise<{ modules: ModuleId[] } | { error: string }> {
  const ids = normalizeModuleIds(modules);
  const { error: upsertError } = await db.from("store_modules").upsert(
    ids.map((module_id) => ({
      store_id: storeId,
      module_id,
      enabled: true,
    })),
    { onConflict: "store_id,module_id" }
  );
  if (upsertError) return { error: upsertError.message };

  const { error: disableError } = await db
    .from("store_modules")
    .update({ enabled: false })
    .eq("store_id", storeId)
    .not("module_id", "in", `(${ids.map((id) => `"${id}"`).join(",")})`);
  if (disableError) return { error: disableError.message };

  const { error: storeError } = await db.from("stores").update({ modules: ids }).eq("id", storeId);
  if (storeError) return { error: storeError.message };

  const { error: profileError } = await db
    .from("profiles")
    .update({ active_modules: ids })
    .eq("id", userId);
  if (profileError) return { error: profileError.message };

  return { modules: ids };
}
