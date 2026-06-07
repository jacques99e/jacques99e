import { supabase } from "@/lib/supabase/client";
import { localStore } from "@/lib/db";
import { normalizeModuleIds } from "@/lib/modules/config";
import type { Store } from "@/types";

export const ACTIVE_STORE_KEY = "wazo_active_store_id";

export interface StoreWithRole extends Store {
  membership_role?: "owner" | "employee" | "manager" | "accountant";
}

export function getActiveStoreId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_STORE_KEY);
}

export function setActiveStore(store: Store) {
  localStore.save(store);
  if (typeof window !== "undefined") {
    localStorage.setItem(ACTIVE_STORE_KEY, store.id);
    localStorage.setItem("store_name", store.name || "");
    localStorage.setItem("store_slug", store.slug || "");
  }
}

export async function loadUserStores(userId: string): Promise<StoreWithRole[]> {
  const stores: StoreWithRole[] = [];
  const seen = new Set<string>();

  const [{ data: owned }, { data: memberships }] = await Promise.all([
    supabase
      .from("stores")
      .select("*")
      .eq("owner_id", userId)
      .order("created_at", { ascending: true }),
    supabase
      .from("store_members")
      .select("store_id, role, stores(*)")
      .eq("user_id", userId),
  ]);

  for (const row of owned || []) {
    if (!seen.has(row.id)) {
      seen.add(row.id);
      stores.push({ ...(row as Store), membership_role: "owner" });
    }
  }

  for (const m of memberships || []) {
    const raw = m.stores as Store | Store[] | null;
    const store = Array.isArray(raw) ? raw[0] : raw;
    if (!store || seen.has(store.id)) continue;
    seen.add(store.id);
    stores.push({
      ...store,
      membership_role: (m.role as StoreWithRole["membership_role"]) || "employee",
    });
  }

  return stores;
}

export async function resolveActiveStore(userId: string): Promise<StoreWithRole | null> {
  const cached = localStore.get() as StoreWithRole | null;
  const activeId = getActiveStoreId();

  if (!navigator.onLine) {
    return cached;
  }

  if (cached?.id) {
    void loadUserStores(userId).then((stores) => {
      if (!stores.length) return;
      const picked =
        stores.find((s) => s.id === activeId) ||
        stores.find((s) => s.id === cached.id) ||
        stores[0];
      setActiveStore(picked);
    });
    return cached;
  }

  const stores = await loadUserStores(userId);
  if (!stores.length) return null;

  const picked =
    stores.find((s) => s.id === activeId) ||
    stores.find((s) => s.id === cached?.id) ||
    stores[0];

  setActiveStore(picked);
  if (picked.modules?.length) {
    const { localModules } = await import("@/lib/db");
    localModules.save(normalizeModuleIds(picked.modules));
  }
  return picked;
}
