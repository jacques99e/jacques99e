"use client";

import { useSync } from "@/hooks/useSync";
import { useI18n } from "@/contexts/I18nContext";

export function ConnectionStatus() {
  const { isOnline, syncing } = useSync();
  const { t } = useI18n();

  const label = syncing
    ? t("offline.syncing")
    : isOnline
      ? t("offline.online")
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
    </span>
  );
}
