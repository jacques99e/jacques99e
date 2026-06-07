"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  loadUserStores,
  resolveActiveStore,
  setActiveStore,
  type StoreWithRole,
} from "@/lib/stores-multi";

export function useActiveStore() {
  const { user } = useAuth();
  const [stores, setStores] = useState<StoreWithRole[]>([]);
  const [activeStore, setActiveStoreState] = useState<StoreWithRole | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = navigator.onLine ? await loadUserStores(user.id) : [];
      const active = await resolveActiveStore(user.id);
      setStores(list.length ? list : active ? [active] : []);
      setActiveStoreState(active);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const switchStore = useCallback(
    async (store: StoreWithRole) => {
      setActiveStore(store);
      setActiveStoreState(store);
      window.dispatchEvent(new Event("wazo-store-changed"));
    },
    []
  );

  return {
    stores,
    activeStore,
    loading,
    refresh,
    switchStore,
    isOwner: activeStore?.membership_role === "owner",
    storeRole: activeStore?.membership_role ?? "owner",
  };
}
