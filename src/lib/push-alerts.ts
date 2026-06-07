import type { AlertSummary } from "@/lib/alerts";

export type PushAlertKind = "stock" | "followup" | "appointment";

export interface PushAlertPayload {
  kind: PushAlertKind;
  title: string;
  message: string;
  url: string;
  dedupKey: string;
}

const SENT_PREFIX = "wazo_push_sent:";

export function wasPushAlertSent(dedupKey: string): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(`${SENT_PREFIX}${dedupKey}`) === "1";
}

export function markPushAlertSent(dedupKey: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(`${SENT_PREFIX}${dedupKey}`, "1");
}

export function buildStockPushAlert(summary: AlertSummary): PushAlertPayload | null {
  if (summary.stockAlerts === 0) return null;
  const today = new Date().toISOString().slice(0, 10);
  const top = summary.lowStockItems[0]?.name;
  const detail =
    summary.outOfStock > 0 && summary.lowStock > 0
      ? `${summary.outOfStock} rupture(s), ${summary.lowStock} stock faible`
      : summary.outOfStock > 0
        ? `${summary.outOfStock} produit(s) en rupture`
        : `${summary.lowStock} produit(s) sous le seuil`;
  return {
    kind: "stock",
    title: "Stock à surveiller",
    message: top ? `${detail} — ex. ${top}` : detail,
    url: "/products",
    dedupKey: `stock:${today}:${summary.outOfStock}:${summary.lowStock}`,
  };
}

export function buildFollowUpPushAlert(summary: AlertSummary): PushAlertPayload | null {
  if (summary.clientAlerts === 0) return null;
  const today = new Date().toISOString().slice(0, 10);
  const parts: string[] = [];
  if (summary.followUpsToday > 0) {
    parts.push(`${summary.followUpsToday} relance(s) aujourd'hui`);
  }
  if (summary.followUpsOverdue > 0) {
    parts.push(`${summary.followUpsOverdue} en retard`);
  }
  return {
    kind: "followup",
    title: "Relances clients",
    message: parts.join(" · "),
    url: "/clients",
    dedupKey: `followup:${today}:${summary.followUpsToday}:${summary.followUpsOverdue}`,
  };
}

export function buildAppointmentPushAlert(
  todayCount: number,
  pendingCount: number
): PushAlertPayload | null {
  if (todayCount === 0 && pendingCount === 0) return null;
  const today = new Date().toISOString().slice(0, 10);
  const message =
    todayCount > 0 && pendingCount > 0
      ? `${todayCount} RDV aujourd'hui · ${pendingCount} en attente de confirmation`
      : todayCount > 0
        ? `${todayCount} rendez-vous prévu(s) aujourd'hui`
        : `${pendingCount} RDV en attente de confirmation`;
  return {
    kind: "appointment",
    title: "Rappel rendez-vous",
    message,
    url: "/health/appointments",
    dedupKey: `appointment:${today}:${todayCount}:${pendingCount}`,
  };
}

export function collectPushAlerts(
  summary: AlertSummary,
  appointmentStats?: { today: number; pending: number }
): PushAlertPayload[] {
  const alerts: PushAlertPayload[] = [];
  const stock = buildStockPushAlert(summary);
  if (stock) alerts.push(stock);
  const follow = buildFollowUpPushAlert(summary);
  if (follow) alerts.push(follow);
  if (appointmentStats) {
    const appt = buildAppointmentPushAlert(appointmentStats.today, appointmentStats.pending);
    if (appt) alerts.push(appt);
  }
  return alerts;
}
