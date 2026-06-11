"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Smartphone, TrendingUp } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { formatCurrency } from "@/lib/utils";

interface MomoSummary {
  pending_count: number;
  paid_today_fcfa: number;
  recent: Array<{ label: string; amount: number; status: string }>;
}

export function MomoPaymentsCard() {
  const [summary, setSummary] = useState<MomoSummary | null>(null);

  useEffect(() => {
    void apiFetch("/api/payments/momo-link/summary")
      .then((res) => res.json())
      .then((json: { success: boolean; pending_count?: number; paid_today_fcfa?: number; recent?: MomoSummary["recent"] }) => {
        if (json.success) {
          setSummary({
            pending_count: json.pending_count ?? 0,
            paid_today_fcfa: json.paid_today_fcfa ?? 0,
            recent: json.recent ?? [],
          });
        }
      })
      .catch(() => undefined);
  }, []);

  if (!summary) return null;
  if (summary.pending_count === 0 && summary.paid_today_fcfa === 0 && summary.recent.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 to-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-orange-900">
          <Smartphone className="h-4 w-4" />
          Liens MoMo PayDunya
        </h2>
        <Link href="/sales/liens" className="text-xs font-medium text-[#075E54] underline">
          Gérer
        </Link>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-center">
        <div className="rounded-xl bg-white p-3">
          <p className="text-xl font-bold text-amber-600">{summary.pending_count}</p>
          <p className="text-[10px] text-gray-500">En attente</p>
        </div>
        <div className="rounded-xl bg-white p-3">
          <p className="flex items-center justify-center gap-1 text-lg font-bold text-[#075E54]">
            <TrendingUp className="h-4 w-4" />
            {formatCurrency(summary.paid_today_fcfa)}
          </p>
          <p className="text-[10px] text-gray-500">Encaissé aujourd&apos;hui</p>
        </div>
      </div>
    </section>
  );
}
