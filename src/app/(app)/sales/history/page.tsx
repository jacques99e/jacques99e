"use client";

import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { downloadCsv, downloadSimplePdf } from "@/lib/export";
import { useI18n } from "@/contexts/I18nContext";
import { localStore } from "@/lib/db";
import { getSales } from "@/lib/sales";
import { formatCurrency } from "@/lib/utils";
import type { Sale } from "@/types";

export default function SalesHistoryPage() {
  const { t } = useI18n();
  const [sales, setSales] = useState<Sale[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");

  useEffect(() => {
    const store = localStore.get();
    if (store) getSales(store.id, date).then(setSales);
  }, [date]);

  const filteredSales = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sales.filter((sale) => {
      const paymentMethod = (sale.payment_method ?? "").toLowerCase();
      const paymentStatus = (sale.payment_status ?? "").toLowerCase();
      const statusOk = paymentFilter === "all" || paymentMethod === paymentFilter;
      const searchOk =
        !q ||
        paymentMethod.includes(q) ||
        paymentStatus.includes(q) ||
        String(sale.total_amount ?? "").includes(q);
      return statusOk && searchOk;
    });
  }, [sales, search, paymentFilter]);

  return (
    <>
      <AppHeader title={t("sales.history")} />
      <main className="mx-auto max-w-lg space-y-4 p-4">
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher (montant, méthode, statut)"
        />
        <select
          value={paymentFilter}
          onChange={(e) => setPaymentFilter(e.target.value)}
          className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm"
        >
          <option value="all">Toutes les méthodes</option>
          <option value="cash">Espèces</option>
          <option value="momo">Mobile money</option>
          <option value="card">Carte</option>
        </select>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button
            variant="outline"
            onClick={() =>
              downloadCsv(
                `ventes-${date}.csv`,
                filteredSales.map((sale) => ({
                  id: sale.id,
                  total_amount: sale.total_amount,
                  payment_method: sale.payment_method ?? "",
                  payment_status: sale.payment_status ?? "",
                  created_at: sale.created_at ?? "",
                }))
              )
            }
          >
            Export CSV
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              void downloadSimplePdf(
                "Historique des ventes",
                filteredSales.map(
                  (sale) =>
                    `${new Date(sale.created_at || "").toLocaleString("fr-FR")} | ${formatCurrency(
                      Number(sale.total_amount)
                    )} | ${sale.payment_method ?? "n/a"} | ${sale.payment_status ?? "n/a"}`
                ),
                `ventes-${date}.pdf`
              )
            }
          >
            Export PDF
          </Button>
        </div>
        {filteredSales.length === 0 ? (
          <p className="text-center text-gray-500 py-8">{t("common.noData")}</p>
        ) : (
          <ul className="space-y-2">
            {filteredSales.map((s) => (
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
