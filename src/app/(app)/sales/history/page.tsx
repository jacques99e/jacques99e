"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useI18n } from "@/contexts/I18nContext";
import { localStore } from "@/lib/db";
import { getSales } from "@/lib/sales";
import { formatCurrency } from "@/lib/utils";
import type { Sale } from "@/types";

export default function SalesHistoryPage() {
  const { t } = useI18n();
  const [sales, setSales] = useState<Sale[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  useEffect(() => {
    const store = localStore.get();
    if (store) getSales(store.id, date).then(setSales);
  }, [date]);

  return (
    <>
      <AppHeader title={t("sales.history")} />
      <main className="mx-auto max-w-lg space-y-4 p-4">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-11 w-full rounded-lg border px-3"
        />
        {sales.length === 0 ? (
          <p className="text-center text-gray-500 py-8">{t("common.noData")}</p>
        ) : (
          <ul className="space-y-2">
            {sales.map((s) => (
              <li key={s.id} className="flex justify-between rounded-xl bg-white p-4 shadow-sm">
                <div>
                  <p className="font-medium">{formatCurrency(Number(s.total_amount))}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(s.created_at || "").toLocaleTimeString()}
                  </p>
                </div>
                <span className="text-xs text-gray-400 capitalize">
                  {s.payment_method?.replace("_", " ")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
