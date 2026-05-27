"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/contexts/I18nContext";
import { localStore } from "@/lib/db";
import { listDeliveries } from "@/lib/logistics";
import type { Delivery } from "@/types";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  picked_up: "bg-blue-100 text-blue-800",
  in_transit: "bg-indigo-100 text-indigo-800",
  delivered: "bg-green-100 text-green-800",
};

export default function LogisticsPage() {
  const { t } = useI18n();
  const store = localStore.get();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);

  useEffect(() => {
    if (store) listDeliveries(store.id).then(setDeliveries);
  }, [store]);

  return (
    <>
      <AppHeader title={t("modules.logistics.title")} />
      <main className="mx-auto max-w-lg space-y-4 p-4">
        <Button asChild className="w-full">
          <Link href="/logistics/deliveries/new">
            <Plus className="h-4 w-4" />
            {t("logistics.newDelivery")}
          </Link>
        </Button>
        <ul className="space-y-2">
          {deliveries.map((d) => (
            <li key={d.id}>
              <Link
                href={`/logistics/deliveries/${encodeURIComponent(d.id)}`}
                className="block rounded-xl bg-white p-3 shadow-sm dark:bg-gray-800"
              >
                <div className="flex justify-between">
                  <span className="font-mono text-sm">{d.tracking_code}</span>
                  <span className={`rounded px-2 text-xs ${statusColors[d.status]}`}>{d.status}</span>
                </div>
                <p className="text-sm">{d.recipient_name}</p>
                <p className="text-xs text-gray-500 truncate">{d.address}</p>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
