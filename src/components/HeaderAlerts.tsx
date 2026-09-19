"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { AlertBadge } from "@/components/AlertBadge";
import { useAlerts } from "@/hooks/useAlerts";
import { useStoreNotifications } from "@/hooks/useStoreNotifications";

export function HeaderAlerts() {
  const { summary } = useAlerts();
  const { unread } = useStoreNotifications();
  const total = summary.total + unread;

  return (
    <Link
      href="/notifications"
      className="relative rounded-full p-1.5 hover:bg-white/10"
      aria-label={total > 0 ? `${total} notification(s)` : "Notifications"}
      title="Notifications"
    >
      <Bell className="h-5 w-5" />
      <AlertBadge count={total} className="-right-0.5 -top-0.5" />
    </Link>
  );
}
