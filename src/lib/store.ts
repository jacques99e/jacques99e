import { db, localModules } from "@/lib/db";
import { resolveActiveStore } from "@/lib/stores-multi";
import type { Store } from "@/types";

/** Charge la boutique active (propriétaire ou membre d'équipe). */
export async function loadUserStore(userId: string): Promise<Store | null> {
  const store = await resolveActiveStore(userId);
  if (store && db) await db.store.put(store);
  if (store?.modules?.length) {
    const { normalizeModuleIds } = await import("@/lib/modules/config");
    localModules.save(normalizeModuleIds(store.modules));
  }
  return store;
}
