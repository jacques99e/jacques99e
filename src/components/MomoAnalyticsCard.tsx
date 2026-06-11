"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Smartphone, TrendingUp } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { useActiveStore } from "@/hooks/useActiveStore";
import { downloadMomoReconciliationPdf } from "@/lib/momo-reconciliation";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface MomoAnalytics {
  total_links: number;
  paid_count: number;
  pending_count: number;
  conversion_rate: number;
  total_paid_fcfa: number;
  paid_today_fcfa: number;
  synced_to_caisse: number;
  chart: Array<{ date: string; amount_fcfa: number; transactions: number }>;
}

export function MomoAnalyticsCard() {
  const { activeStore } = useActiveStore();
  const storeId = activeStore?.id;
  const [data, setData] = useState<MomoAnalytics | null>(null);

  useEffect(() => {
    if (!storeId) return;
    void apiFetch(`/api/payments/momo-link/analytics?store_id=${encodeURIComponent(storeId)}`)
      .then((res) => res.json())
      .then((json: { success: boolean } & Partial<MomoAnalytics>) => {
        if (json.success) {
          setData({
            total_links: json.total_links ?? 0,
            paid_count: json.paid_count ?? 0,
            pending_count: json.pending_count ?? 0,
            conversion_rate: json.conversion_rate ?? 0,
            total_paid_fcfa: json.total_paid_fcfa ?? 0,
            paid_today_fcfa: json.paid_today_fcfa ?? 0,
            synced_to_caisse: json.synced_to_caisse ?? 0,
            chart: json.chart ?? [],
          });
        }
      })
      .catch(() => undefined);
  }, [storeId]);

  const exportReconciliation = async () => {
    if (!storeId) return;
    const res = await apiFetch(`/api/payments/momo-link/reconciliation?store_id=${encodeURIComponent(storeId)}`);
    const json = (await res.json()) as { success: boolean; report?: Parameters<typeof downloadMomoReconciliationPdf>[0] };
    if (json.success && json.report) await downloadMomoReconciliationPdf(json.report);
  };

  if (!data || data.total_links === 0) return null;

  const maxChart = Math.max(...data.chart.map((c) => c.amount_fcfa), 1);

  return (
    <section className="app-card space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <Smartphone className="h-4 w-4 text-orange-600" />
          MoMo PayDunya (30 jours)
        </h2>
        <Link href="/sales/liens" className="text-xs text-[#075E54] underline">
          Détails
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-lg bg-orange-50 p-2 text-center">
          <p className="text-lg font-bold text-orange-800">{data.conversion_rate}%</p>
          <p className="text-[10px] text-gray-500">Conversion</p>
        </div>
        <div className="rounded-lg bg-green-50 p-2 text-center">
          <p className="text-lg font-bold text-green-800">{formatCurrency(data.total_paid_fcfa)}</p>
          <p className="text-[10px] text-gray-500">Encaissé</p>
        </div>
        <div className="rounded-lg bg-gray-50 p-2 text-center">
          <p className="text-lg font-bold">{data.paid_count}</p>
          <p className="text-[10px] text-gray-500">Payés</p>
        </div>
        <div className="rounded-lg bg-amber-50 p-2 text-center">
          <p className="text-lg font-bold text-amber-700">{data.pending_count}</p>
          <p className="text-[10px] text-gray-500">En attente</p>
        </div>
      </div>

      <p className="flex items-center gap-1 text-xs text-gray-600">
        <TrendingUp className="h-3 w-3" />
        Aujourd&apos;hui : {formatCurrency(data.paid_today_fcfa)} • {data.synced_to_caisse} vente(s) sync caisse
      </p>

      {data.chart.length > 0 ? (
        <div className="space-y-1">
          <p className="text-[10px] font-medium text-gray-500">Encaissements récents</p>
          {data.chart.slice(-7).map((row) => (
            <div key={row.date} className="flex items-center gap-2 text-[10px]">
              <span className="w-16 shrink-0 text-gray-500">{row.date.slice(5)}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-[#075E54]"
                  style={{ width: `${Math.round((row.amount_fcfa / maxChart) * 100)}%` }}
                />
              </div>
              <span className="w-20 shrink-0 text-right font-medium">{formatCurrency(row.amount_fcfa)}</span>
            </div>
          ))}
        </div>
      ) : null}

      <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => void exportReconciliation()}>
        Télécharger réconciliation MoMo / caisse (PDF)
      </Button>
    </section>
  );
}
