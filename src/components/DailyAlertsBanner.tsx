"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import {
  buildDailyDigestMessage,
  markDailyDigestShown,
  shouldShowDailyDigest,
} from "@/lib/alerts";
import { useAlerts } from "@/hooks/useAlerts";
import { useModule } from "@/hooks/useModule";
import { localStore } from "@/lib/db";

export function DailyAlertsBanner() {
  const { summary } = useAlerts();
  const { modules } = useModule(localStore.get()?.id);
  const hasCommerce = modules.includes("commerce");
  const hasHealth = modules.includes("health");
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const digest = buildDailyDigestMessage(summary);
    if (digest && shouldShowDailyDigest()) {
      setMessage(digest);
      setVisible(true);
      markDailyDigestShown();
    }
  }, [summary]);

  if ((!hasCommerce && !hasHealth) || !visible || !message) return null;

  return (
    <div className="sticky top-0 z-50 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
      <div className="mx-auto flex max-w-lg items-start gap-2">
        <Bell className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="flex-1">
          <p className="font-semibold">Alertes du jour</p>
          <p className="mt-0.5">{message}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {summary.stockAlerts > 0 ? (
              <Link href="/products" className="underline">
                Voir stock ({summary.stockAlerts})
              </Link>
            ) : null}
            {summary.clientAlerts > 0 ? (
              <Link href="/clients" className="underline">
                Voir relances ({summary.clientAlerts})
              </Link>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          aria-label="Masquer"
          className="rounded p-1 hover:bg-amber-100"
          onClick={() => setVisible(false)}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
