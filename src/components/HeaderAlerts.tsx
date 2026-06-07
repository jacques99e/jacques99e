"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { AlertBadge } from "@/components/AlertBadge";
import { useAlerts } from "@/hooks/useAlerts";

export function HeaderAlerts() {
  const { summary } = useAlerts();
  if (summary.total <= 0) return null;

  return (
    <Link
      href="/dashboard"
      className="relative rounded-full p-1.5 hover:bg-white/10"
      aria-label={`${summary.total} alerte(s) active(s)`}
      title="Voir les alertes"
    >
      <Bell className="h-5 w-5" />
      <AlertBadge count={summary.total} className="-right-0.5 -top-0.5" />
    </Link>
  );
}
