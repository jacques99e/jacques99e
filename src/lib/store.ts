import { supabase } from "@/lib/supabase/client";
import { db, localStore } from "@/lib/db";
import type { Store } from "@/types";

/** Charge la boutique du commerçant depuis Supabase et met en cache local. */
export async function loadUserStore(ownerId: string): Promise<Store | null> {
  const cached = localStore.get();
  if (cached && cached.owner_id === ownerId) return cached;

  if (!navigator.onLine) return cached;

  const { data } = await supabase
    .from("stores")
    .select("*")
    .eq("owner_id", ownerId)
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const store = data as Store;
  localStore.save(store);
  if (db) await db.store.put(store);
  return store;
}
