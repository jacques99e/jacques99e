"use client";

import { useCallback, useEffect, useState } from "react";
import { useOnlineStatus } from "./useOnlineStatus";
import { syncAll } from "@/lib/sync";
import { localStore } from "@/lib/db";

export function useSync() {
  const isOnline = useOnlineStatus();
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const runSync = useCallback(async () => {
    const store = localStore.get();
    if (!store?.id || !navigator.onLine) return;

    setSyncing(true);
    try {
      const result = await syncAll(store.id);
      if (result.synced > 0) setLastSync(new Date());
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    if (isOnline) {
      runSync();
      const interval = setInterval(runSync, 60000);
      return () => clearInterval(interval);
    }
  }, [isOnline, runSync]);

  return { isOnline, syncing, lastSync, runSync };
}
