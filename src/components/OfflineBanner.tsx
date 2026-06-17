"use client";

import { useSync } from "@/hooks/useSync";
import { useI18n } from "@/contexts/I18nContext";

export function OfflineBanner() {
  const { isOnline, pendingCount } = useSync();
  const { t } = useI18n();

  if (isOnline) return null;

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs text-amber-900">
      <strong>{t("offline.offline")}</strong>
      {" — "}
      Caisse, produits, clients, livraisons et patients restent utilisables. Les photos et SMS
      nécessitent internet.
      {pendingCount > 0 ? ` (${pendingCount} action${pendingCount > 1 ? "s" : ""} en attente de sync)` : null}
    </div>
  );
}
