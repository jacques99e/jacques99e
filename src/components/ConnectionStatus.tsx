"use client";

import { useSync } from "@/hooks/useSync";
import { useI18n } from "@/contexts/I18nContext";

export function ConnectionStatus() {
  const { isOnline, syncing, pendingCount } = useSync();
  const { t } = useI18n();

  const label = syncing
    ? t("offline.syncing")
    : isOnline
      ? pendingCount > 0
        ? `${t("offline.online")} · ${pendingCount} en attente`
        : t("offline.online")
      : t("offline.offline");

  return (
    <span className="flex items-center gap-1.5 text-xs" title={label}>
      <span
        className={`h-2.5 w-2.5 rounded-full ${
          syncing
            ? "bg-yellow-400 animate-pulse"
            : isOnline
              ? "bg-green-400"
              : "bg-red-500"
        }`}
      />
      <span className="text-white/80 hidden sm:inline">{label}</span>
      {pendingCount > 0 && !syncing ? (
        <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[9px] font-bold text-amber-950">
          {pendingCount}
        </span>
      ) : null}
    </span>
  );
}
