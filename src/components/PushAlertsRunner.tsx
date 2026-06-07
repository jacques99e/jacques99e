"use client";

import { usePushAlerts } from "@/hooks/usePushAlerts";

/** Monte le moteur d'alertes push (stock, relances, RDV) sans rendu UI. */
export function PushAlertsRunner() {
  usePushAlerts();
  return null;
}
