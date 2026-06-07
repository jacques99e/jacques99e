"use client";

import type { AlertSummary } from "@/lib/alerts";
import { buildDailyDigestMessage } from "@/lib/alerts";

const LAST_PUSH_KEY = "wazo_last_alert_push";

export function maybeShowBrowserAlert(summary: AlertSummary) {
  if (typeof window === "undefined") return;
  if (localStorage.getItem("wazo_push_enabled") !== "1") return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  if (summary.total === 0) return;

  const digest = buildDailyDigestMessage(summary);
  if (!digest) return;

  const today = new Date().toISOString().slice(0, 10);
  const last = localStorage.getItem(LAST_PUSH_KEY);
  if (last === `${today}:${summary.total}`) return;

  localStorage.setItem(LAST_PUSH_KEY, `${today}:${summary.total}`);

  try {
    new Notification("Wazo Digital — Alertes", {
      body: digest,
      icon: "/icons/icon.svg",
      tag: "wazo-alerts",
    });
  } catch {
    // ignore
  }
}
