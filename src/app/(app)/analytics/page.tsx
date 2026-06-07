"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModuleStatGrid } from "@/components/ModuleStatGrid";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { useModule } from "@/hooks/useModule";
import { listParcels } from "@/lib/agriculture";
import { listAssets } from "@/lib/blockchain";
import { localStore } from "@/lib/db";
import { listCourses } from "@/lib/education";
import { downloadCsv, downloadSimplePdf } from "@/lib/export";
import { listPatients } from "@/lib/health";
import { readLocalProducts } from "@/lib/local-products";
import { readLocalSales as readSalesForStore } from "@/lib/local-sales";
import { listDeliveries } from "@/lib/logistics";
import { MODULE_LABELS } from "@/lib/modules/config";
import {
  analyticsShortcutsForModules,
  EMPTY_MODULE_OPS,
  moduleOpsLabels,
  type ModuleOpsSnapshot,
} from "@/lib/modules/analytics";
import { formatCurrency } from "@/lib/utils";
import { downloadWeeklyReportPdf } from "@/lib/weekly-report";

type LocalSale = {
  total?: number;
  total_amount?: number;
  created_at?: string;
  date?: string;
};

function readLocalSales(): LocalSale[] {
  const store = localStore.get();
  return readSalesForStore(store?.id);
}

function getRangeStart(period: string, customStart: string): string | null {
  if (period === "all") return null;
  if (period === "custom") return customStart || null;
  const days = period === "today" ? 0 : period === "7d" ? 7 : 30;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export default function AnalyticsPage() {
  const { user } = useAuth();
  const { canViewAnalytics, role } = useRole(user?.id);
  const store = localStore.get();
  const { modules } = useModule(store?.id);
  const hasCommerce = modules.includes("commerce");
  const [period, setPeriod] = useState<"today" | "7d" | "30d" | "all" | "custom">("30d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [moduleOps, setModuleOps] = useState<ModuleOpsSnapshot>(EMPTY_MODULE_OPS);
  const [reportLoading, setReportLoading] = useState(false);
  const storeLabel = store?.name || "Wazo Digital";
  const shortcuts = analyticsShortcutsForModules(modules);
  const opsRows = moduleOpsLabels(modules);

  useEffect(() => {
    if (!store?.id) return;
    let cancelled = false;

    const load = async () => {
      const ops = { ...EMPTY_MODULE_OPS };
      const tasks: Promise<void>[] = [];

      if (modules.includes("logistics")) {
        tasks.push(
          listDeliveries(store.id).then((rows) => {
            ops.deliveries = rows.length;
          })
        );
      }
      if (modules.includes("health")) {
        tasks.push(
          listPatients(store.id).then((rows) => {
            ops.patients = rows.length;
          })
        );
      }
      if (modules.includes("education")) {
        tasks.push(
          listCourses(store.id).then((rows) => {
            ops.courses = rows.length;
          })
        );
      }
      if (modules.includes("blockchain")) {
        tasks.push(
          listAssets(store.id).then((rows) => {
            ops.assets = rows.length;
          })
        );
      }
      if (modules.includes("agriculture")) {
        tasks.push(
          listParcels(store.id).then((rows) => {
            ops.parcels = rows.length;
          })
        );
      }

      await Promise.all(tasks);
      if (!cancelled) setModuleOps(ops);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [store?.id, modules]);

  const { products, sales, revenue, outOfStock, filteredSales } = useMemo(() => {
    const p = readLocalProducts();
    const allSales = readLocalSales();
    const startIso = getRangeStart(period, customStart);
    const endIso = period === "custom" && customEnd ? new Date(customEnd + "T23:59:59").toISOString() : null;
    const s = allSales.filter((item) => {
      const at = item.created_at || item.date;
      if (!at) return period === "all";
      const iso = new Date(at).toISOString();
      if (startIso && iso < startIso) return false;
      if (endIso && iso > endIso) return false;
      return true;
    });
    return {
      products: p.length,
      sales: s.length,
      revenue: s.reduce((sum, item) => sum + Number(item.total ?? item.total_amount ?? 0), 0),
      outOfStock: p.filter((item) => Number(item.stock ?? item.stock_quantity ?? 0) <= 0).length,
      filteredSales: s,
    };
  }, [period, customStart, customEnd]);

  const salesByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const sale of filteredSales) {
      const parsed = new Date(sale.created_at || sale.date || "");
      if (Number.isNaN(parsed.getTime())) continue;
      const d = parsed.toISOString().slice(0, 10);
      map.set(d, (map.get(d) || 0) + Number(sale.total ?? sale.total_amount ?? 0));
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredSales]);

  const exportRows = useMemo(() => {
    const rows: Array<{ metric: string; value: string | number }> = [];
    if (hasCommerce) {
      rows.push(
        { metric: "produits", value: products },
        { metric: "ventes", value: sales },
        { metric: "chiffre_affaires", value: revenue },
        { metric: "ruptures", value: outOfStock },
        ...salesByDay.map(([day, total]) => ({ metric: `ca_${day}`, value: total }))
      );
    }
    for (const row of opsRows) {
      rows.push({ metric: row.label.toLowerCase(), value: moduleOps[row.key] });
    }
    return rows;
  }, [hasCommerce, products, sales, revenue, outOfStock, salesByDay, opsRows, moduleOps]);

  if (!canViewAnalytics) {
    return (
      <>
        <AppHeader title="Analytics" subtitle="Pilotage" />
        <main className="app-page pb-6">
          <section className="app-card border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Accès limité pour le rôle <strong>{role}</strong>. Les analytics sont réservés au propriétaire et aux employés.
          </section>
        </main>
      </>
    );
  }

  return (
    <>
      <AppHeader title="Analytics" subtitle="Pilotage" />
      <main className="app-page space-y-4 pb-6">
        <section className="app-card p-4">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">Période</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {(["today", "7d", "30d", "all", "custom"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setPeriod(value)}
                className={`rounded-lg px-2 py-2 text-xs ${
                  period === value ? "bg-wazo-green text-white" : "bg-gray-100 text-gray-700"
                }`}
              >
                {value}
              </button>
            ))}
          </div>
          {period === "custom" ? (
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
              <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
            </div>
          ) : null}
        </section>

        {hasCommerce ? (
          <ModuleStatGrid
            columns={2}
            items={[
              { value: products, label: "Produits" },
              { value: sales, label: "Ventes" },
              { value: formatCurrency(revenue), label: "Chiffre d'affaires" },
              { value: outOfStock, label: "Ruptures", accent: "text-red-600" },
            ]}
          />
        ) : null}

        {opsRows.length > 0 ? (
          <ModuleStatGrid
            columns={opsRows.length >= 3 ? 3 : 2}
            items={opsRows.map((row) => ({
              value: moduleOps[row.key],
              label: row.label,
            }))}
          />
        ) : null}

        {hasCommerce ? (
          <section className="app-card p-4">
            <h2 className="mb-2 text-sm font-semibold text-gray-700">CA par jour</h2>
            {salesByDay.length === 0 ? (
              <p className="text-sm text-gray-500">Aucune donnée.</p>
            ) : (
              <ul className="space-y-1 text-xs">
                {salesByDay.map(([day, total]) => (
                  <li key={day} className="flex items-center justify-between rounded bg-gray-50 px-2 py-1.5">
                    <span>{day}</span>
                    <span className="font-medium">{formatCurrency(total)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        <section className="app-card p-4">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">Modules actifs</h2>
          <div className="flex flex-wrap gap-2">
            {modules.map((id) => (
              <span key={id} className="rounded-full bg-wazo-green/10 px-3 py-1 text-xs text-wazo-green">
                {MODULE_LABELS[id]}
              </span>
            ))}
          </div>
        </section>

        {hasCommerce ? (
          <section className="app-card p-4">
            <h2 className="mb-2 text-sm font-semibold text-gray-700">Rapport hebdomadaire</h2>
            <p className="mb-2 text-xs text-gray-500">
              Ventes, stock et paiements des 7 derniers jours en un seul PDF.
            </p>
            <Button
              type="button"
              className="w-full"
              disabled={reportLoading}
              onClick={() => {
                setReportLoading(true);
                void downloadWeeklyReportPdf(storeLabel).finally(() => setReportLoading(false));
              }}
            >
              {reportLoading ? "Génération..." : "Télécharger rapport hebdo PDF"}
            </Button>
          </section>
        ) : null}

        <section className="app-card p-4">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">Rapport global</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                downloadCsv(`rapport-global-${new Date().toISOString().slice(0, 10)}.csv`, exportRows)
              }
            >
              Export CSV global
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={async () =>
                downloadSimplePdf(
                  "Rapport Global Wazo Digital",
                  exportRows.map((row) => `${row.metric}: ${row.value}`),
                  `rapport-global-${new Date().toISOString().slice(0, 10)}.pdf`
                )
              }
            >
              Export PDF global
            </Button>
          </div>
        </section>

        {shortcuts.length > 0 ? (
          <section className="app-card p-4 text-sm">
            <h2 className="mb-2 font-semibold text-gray-700">Raccourcis</h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {shortcuts.map((item) => (
                <Link key={item.href} href={item.href} className="rounded-lg bg-gray-50 px-3 py-2 hover:bg-gray-100">
                  {item.label}
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </>
  );
}
