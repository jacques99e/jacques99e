"use client";

import { useCallback, useEffect } from "react";
import { useActiveStore } from "@/hooks/useActiveStore";
import { useAlerts } from "@/hooks/useAlerts";
import { useModule } from "@/hooks/useModule";
import { apiFetch } from "@/lib/api-client";
import { maybeShowBrowserAlert } from "@/lib/alert-notifications";
import {
  collectPushAlerts,
  markPushAlertSent,
  wasPushAlertSent,
} from "@/lib/push-alerts";
import { listAppointmentsWithPatients } from "@/lib/health";

const PUSH_ENABLED_KEY = "wazo_push_enabled";

function countAppointmentStats(
  rows: Awaited<ReturnType<typeof listAppointmentsWithPatients>>
) {
  const today = new Date().toISOString().slice(0, 10);
  let todayCount = 0;
  let pendingCount = 0;
  for (const row of rows) {
    const day = row.scheduled_at?.slice(0, 10);
    if (day === today) todayCount += 1;
    if (row.status === "pending" && day && day >= today) pendingCount += 1;
  }
  return { today: todayCount, pending: pendingCount };
}

export function usePushAlerts() {
  const { activeStore } = useActiveStore();
  const { summary } = useAlerts();
  const { modules } = useModule(activeStore?.id);
  const hasHealth = modules.includes("health");

  const dispatch = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(PUSH_ENABLED_KEY) !== "1") return;
    if (!activeStore?.id) return;

    maybeShowBrowserAlert(summary);

    let appointmentStats: { today: number; pending: number } | undefined;
    if (hasHealth && navigator.onLine) {
      try {
        const rows = await listAppointmentsWithPatients(activeStore.id);
        appointmentStats = countAppointmentStats(rows);
      } catch {
        appointmentStats = undefined;
      }
    }

    const payloads = collectPushAlerts(summary, appointmentStats);
    for (const alert of payloads) {
      if (wasPushAlertSent(alert.dedupKey)) continue;
      try {
        const res = await apiFetch("/api/push/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            store_id: activeStore.id,
            title: alert.title,
            message: alert.message,
            url: alert.url,
          }),
        });
        if (res.ok) markPushAlertSent(alert.dedupKey);
      } catch {
        // ignore network errors
      }
    }
  }, [activeStore?.id, hasHealth, summary]);

  useEffect(() => {
    void dispatch();
    const interval = window.setInterval(() => void dispatch(), 5 * 60_000);
    return () => window.clearInterval(interval);
  }, [dispatch]);
}
