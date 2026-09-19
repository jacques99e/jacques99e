import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { localStore } from "@/lib/db";
import type { StoreNotificationRow } from "@/lib/evolution-notify";

const REFRESH_MS = 10 * 60 * 1000;

function refreshKey(storeId: string) {
  return `wazo_evo_refresh_${storeId}`;
}

export function useStoreNotifications(options?: { list?: boolean }) {
  const storeId = localStore.get()?.id;
  const withList = options?.list === true;
  const [items, setItems] = useState<StoreNotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const stampKey = refreshKey(storeId);
      const last = Number(sessionStorage.getItem(stampKey) || "0");
      if (!last || Date.now() - last > REFRESH_MS) {
        await apiFetch("/api/notifications/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ store_id: storeId }),
        });
        sessionStorage.setItem(stampKey, String(Date.now()));
      }

      const qs = new URLSearchParams({ store_id: storeId });
      if (!withList) qs.set("unread", "1");
      const res = await apiFetch(`/api/notifications?${qs.toString()}`);
      const data = (await res.json()) as {
        success?: boolean;
        notifications?: StoreNotificationRow[];
        unread?: number;
      };
      if (res.ok && data.success) {
        const rows = data.notifications || [];
        if (withList) setItems(rows);
        setUnread(data.unread ?? rows.filter((n) => !n.read_at).length);
      }
    } catch {
      /* offline */
    } finally {
      setLoading(false);
    }
  }, [storeId, withList]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const markRead = useCallback(
    async (ids?: string[]) => {
      if (!storeId) return;
      await apiFetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ store_id: storeId, ids }),
      });
      setItems((prev) =>
        prev.map((row) =>
          !ids || ids.includes(row.id)
            ? { ...row, read_at: row.read_at || new Date().toISOString() }
            : row
        )
      );
      setUnread((prev) => (ids ? Math.max(0, prev - ids.length) : 0));
    },
    [storeId]
  );

  return { storeId, items, unread, loading, refresh, markRead };
}
