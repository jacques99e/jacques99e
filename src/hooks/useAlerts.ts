"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ALERTS_REFRESH_EVENT,
  type AlertSummary,
  computeAlertSummary,
} from "@/lib/alerts";
const empty: AlertSummary = {
  outOfStock: 0,
  lowStock: 0,
  stockAlerts: 0,
  followUpsToday: 0,
  followUpsOverdue: 0,
  clientAlerts: 0,
  total: 0,
  lowStockItems: [],
};

export function useAlerts() {
  const [summary, setSummary] = useState<AlertSummary>(empty);

  const refresh = useCallback(() => {
    const next = computeAlertSummary();
    setSummary(next);
  }, []);

  useEffect(() => {
    refresh();

    const onRefresh = () => refresh();
    const onStorage = (event: StorageEvent) => {
      if (
        !event.key ||
        event.key === "wazo_products" ||
        event.key === "wazo_clients" ||
        event.key === "wazo_sales"
      ) {
        refresh();
      }
    };

    window.addEventListener(ALERTS_REFRESH_EVENT, onRefresh);
    window.addEventListener("storage", onStorage);
    const interval = window.setInterval(refresh, 30_000);

    return () => {
      window.removeEventListener(ALERTS_REFRESH_EVENT, onRefresh);
      window.removeEventListener("storage", onStorage);
      window.clearInterval(interval);
    };
  }, [refresh]);

  return { summary, refresh };
}
