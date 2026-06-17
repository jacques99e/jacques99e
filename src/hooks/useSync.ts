"use client";

import { useCallback, useEffect, useState } from "react";
import { useOnlineStatus } from "./useOnlineStatus";
import { syncAll } from "@/lib/sync";
import { db, localStore } from "@/lib/db";

export function useSync() {
  const isOnline = useOnlineStatus();
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  const refreshPending = useCallback(async () => {
    if (!db) {
      setPendingCount(0);
      return;
    }
    const count = await db.syncQueue.count();
    setPendingCount(count);
  }, []);

  const runSync = useCallback(async () => {
    const store = localStore.get();
    if (!store?.id || !navigator.onLine) {
      await refreshPending();
      return;
    }

    setSyncing(true);
    try {
      const result = await syncAll(store.id);
      if (result.synced > 0) {
        setLastSync(new Date());
        localStorage.setItem("wazo_last_sync_ok", new Date().toISOString());
      }
    } finally {
      setSyncing(false);
      await refreshPending();
    }
  }, [refreshPending]);

  useEffect(() => {
    void refreshPending();
  }, [refreshPending]);

  useEffect(() => {
    if (isOnline) {
      runSync();
      const interval = setInterval(runSync, 60000);
      return () => clearInterval(interval);
    }
  }, [isOnline, runSync]);

  return { isOnline, syncing, lastSync, pendingCount, runSync };
}
