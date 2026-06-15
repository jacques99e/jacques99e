"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  Target,
  Package,
  Users,
  Lightbulb,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { SalesChart } from "@/components/SalesChart";
import { useAuth } from "@/hooks/useAuth";
import { useBilling } from "@/hooks/useBilling";
import { useRole } from "@/hooks/useRole";
import { computeBusinessInsights, type BusinessInsights } from "@/lib/insights";
import { formatCurrency } from "@/lib/utils";
import { downloadWeeklyReportPdf } from "@/lib/weekly-report";
import { PlanUpgradeGate } from "@/components/PlanUpgradeGate";
import { localStore } from "@/lib/db";

export default function InsightsPage() {
  const { user } = useAuth();
  const { canViewAnalytics } = useRole(user?.id);
  const { canUseAnalytics, loading: billingLoading } = useBilling();
  const [insights, setInsights] = useState<BusinessInsights | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const storeName = localStore.get()?.name || "Wazo Digital";

  const refresh = useCallback(() => {
    setInsights(computeBusinessInsights());
  }, []);

  useEffect(() => {
    refresh();
    const onStorage = (e: StorageEvent) => {
      if (
        e.key === "wazo_sales" ||
        e.key === "wazo_products" ||
        e.key === "wazo_clients" ||
        e.key === "wazo_business_settings"
      ) {
        refresh();
      }
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("wazo-business-settings-changed", refresh);
    window.addEventListener("wazo-alerts-refresh", refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("wazo-business-settings-changed", refresh);
      window.removeEventListener("wazo-alerts-refresh", refresh);
    };
  }, [refresh]);

  if (!canViewAnalytics) {
    return (
      <>
        <AppHeader title="Insights Pro" />
        <main className="mx-auto max-w-lg p-4">
          <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
            Accès réservé aux comptes avec droits analytics. Contactez le propriétaire de la boutique.
          </p>
        </main>
      </>
    );
  }

  if (!billingLoading && !canUseAnalytics) {
    return (
      <PlanUpgradeGate
        title="Insights Pro"
        message="Les insights avancés et rapports PDF sont inclus dans le plan PRO ou BUSINESS."
        requiredPlan="pro"
      />
    );
  }

  if (!insights) {
    return (
      <>
        <AppHeader title="Insights Pro" />
        <main className="mx-auto max-w-lg p-4 text-center text-sm text-gray-500">
          Chargement...
        </main>
      </>
    );
  }

  const growth = insights.weekGrowthPercent;

  return (
    <>
      <AppHeader title="Insights Pro" />
      <main className="mx-auto max-w-lg space-y-4 p-4 pb-8">
        <p className="text-xs text-gray-500">
          Pilotage avancé basé sur vos ventes, stock et CRM — mis à jour en temps réel.
        </p>

        <section className="rounded-2xl bg-gradient-to-br from-[#075E54] to-[#128C7E] p-4 text-white shadow-md">
          <p className="text-xs text-white/80">Chiffre d&apos;affaires — 7 jours</p>
          <p className="mt-1 text-3xl font-bold">{formatCurrency(insights.weekRevenue)}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
            {growth != null ? (
              <span className="flex items-center gap-1 rounded-full bg-white/15 px-2 py-1">
                {growth >= 0 ? (
                  <TrendingUp className="h-3.5 w-3.5" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5" />
                )}
                {growth >= 0 ? "+" : ""}
                {growth}% vs semaine précédente
              </span>
            ) : null}
            <span>Moy. jour: {formatCurrency(insights.avgDailyRevenue)}</span>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm dark:bg-gray-800">
          <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-200">
            Tendance CA (7 jours)
          </h2>
          <SalesChart data={insights.last7Days} />
        </section>

        <section className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-gray-800">
            <p className="text-[10px] text-gray-500">Projection mois</p>
            <p className="text-lg font-bold text-[#075E54]">
              {formatCurrency(insights.projectedMonthRevenue)}
            </p>
          </div>
          <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-gray-800">
            <p className="text-[10px] text-gray-500">CA mois en cours</p>
            <p className="text-lg font-bold text-[#075E54]">
              {formatCurrency(insights.monthToDateRevenue)}
            </p>
          </div>
          <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-gray-800">
            <p className="text-[10px] text-gray-500">Panier moyen</p>
            <p className="text-lg font-bold text-[#075E54]">
              {formatCurrency(insights.avgBasket)}
            </p>
          </div>
          <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-gray-800">
            <p className="text-[10px] text-gray-500">Valeur stock</p>
            <p className="text-lg font-bold text-[#075E54]">
              {formatCurrency(insights.stockValue)}
            </p>
          </div>
        </section>

        {insights.monthlyTarget != null && insights.targetProgressPercent != null ? (
          <section className="rounded-2xl bg-white p-4 shadow-sm dark:bg-gray-800">
            <div className="mb-2 flex items-center gap-2">
              <Target className="h-4 w-4 text-[#075E54]" />
              <h2 className="text-sm font-semibold">Objectif mensuel</h2>
            </div>
            <p className="text-xs text-gray-500">
              {formatCurrency(insights.monthToDateRevenue)} / {formatCurrency(insights.monthlyTarget)}
            </p>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-[#075E54] transition-all"
                style={{ width: `${insights.targetProgressPercent}%` }}
              />
            </div>
            <p className="mt-1 text-xs font-medium text-[#075E54]">
              {insights.targetProgressPercent}% atteint
            </p>
            <Link
              href="/settings/business"
              className="mt-2 inline-block text-xs text-[#075E54] underline"
            >
              Modifier l&apos;objectif
            </Link>
          </section>
        ) : (
          <Link
            href="/settings/business"
            className="block rounded-xl border border-dashed border-[#075E54]/40 p-3 text-center text-xs text-[#075E54]"
          >
            Définir un objectif de CA mensuel →
          </Link>
        )}

        <section className="rounded-2xl bg-white p-4 shadow-sm dark:bg-gray-800">
          <div className="mb-3 flex items-center gap-2">
            <Package className="h-4 w-4 text-[#075E54]" />
            <h2 className="text-sm font-semibold">Top produits (CA)</h2>
          </div>
          {insights.topProducts.length === 0 ? (
            <p className="text-xs text-gray-500">Pas encore de ventes enregistrées.</p>
          ) : (
            <ul className="space-y-2">
              {insights.topProducts.map((p) => (
                <li
                  key={p.name}
                  className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-gray-900"
                >
                  <span className="font-medium">{p.name}</span>
                  <span className="text-xs text-[#075E54]">
                    {formatCurrency(p.revenue)} · {p.quantity} u.
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm dark:bg-gray-800">
          <div className="mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-[#075E54]" />
            <h2 className="text-sm font-semibold">Clients CRM</h2>
          </div>
          <p className="mb-2 text-xs text-gray-500">
            {insights.crmTotal} client(s) · {insights.crmActiveRate}% actifs
          </p>
          {insights.topClients.length === 0 ? (
            <Link href="/clients" className="text-xs text-[#075E54] underline">
              Ajouter des clients au CRM →
            </Link>
          ) : (
            <ul className="space-y-2">
              {insights.topClients.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-gray-900"
                >
                  <div>
                    <p className="font-medium">{c.name}</p>
                    <p className="text-[10px] text-gray-500">{c.status}</p>
                  </div>
                  <span className="text-xs text-[#075E54]">
                    {c.purchases > 0
                      ? `${formatCurrency(c.revenue)} · ${c.purchases} achat(s)`
                      : "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="mb-2 flex items-center gap-2 text-amber-900">
            <Lightbulb className="h-4 w-4" />
            <h2 className="text-sm font-semibold">Recommandations IA</h2>
          </div>
          <ul className="space-y-2 text-xs text-amber-900">
            {insights.recommendations.map((rec, i) => (
              <li key={i} className="flex gap-2">
                <span className="font-bold">{i + 1}.</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </section>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button
            variant="outline"
            disabled={reportLoading}
            onClick={() => {
              setReportLoading(true);
              void downloadWeeklyReportPdf(storeName).finally(() => setReportLoading(false));
            }}
          >
            {reportLoading ? "PDF..." : "Rapport hebdo PDF"}
          </Button>
          <Button asChild className="bg-[#075E54] hover:opacity-90">
            <Link href="/analytics">Analytics détaillés</Link>
          </Button>
        </div>
      </main>
    </>
  );
}
