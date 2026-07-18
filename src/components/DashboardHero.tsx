"use client";

import Link from "next/link";
import { Plus, ShoppingBag, TrendingUp } from "lucide-react";
import { MODULES } from "@/lib/modules/config";
import { useI18n } from "@/contexts/I18nContext";
import { useModuleLabel } from "@/hooks/useModuleLabel";
import { formatCurrency } from "@/lib/utils";
import type { ModuleId } from "@/types";

interface DashboardHeroProps {
  storeName: string;
  activeModules: ModuleId[];
  primaryModule: ModuleId;
  todayTotal?: number;
  todaySalesCount?: number;
}

export function DashboardHero({
  storeName,
  activeModules,
  primaryModule,
  todayTotal = 0,
  todaySalesCount = 0,
}: DashboardHeroProps) {
  const { t } = useI18n();
  const primaryLabel = useModuleLabel(primaryModule);
  const hasCommerce = activeModules.includes("commerce");
  const primary = MODULES[primaryModule];
  const PrimaryIcon = primary.icon;
  const saleWord =
    todaySalesCount === 1 ? t("dashboard.sale") : t("dashboard.sales");
  const moduleCountLabel =
    activeModules.length > 1
      ? `${activeModules.length} ${t("dashboard.modulesActive")}`
      : `${activeModules.length} ${t("dashboard.moduleActive")}`;

  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-wazo-green via-wazo-green to-wazo-green-light p-5 text-white shadow-wazo-lg">
      <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -bottom-12 -left-8 h-32 w-32 rounded-full bg-wazo-orange/20" />

      <div className="relative">
        <p className="text-xs font-medium uppercase tracking-wider text-white/70">
          {t("dashboard.subtitle")}
        </p>
        <h2 className="mt-1 text-2xl font-extrabold tracking-tight">
          {t("dashboard.hello")} {storeName}
        </h2>

        {hasCommerce ? (
          <div className="mt-4 rounded-2xl bg-white/15 p-4 backdrop-blur-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-white/80">{t("dashboard.todaySales")}</p>
                <p className="text-3xl font-bold tracking-tight">{formatCurrency(todayTotal)}</p>
                <p className="mt-1 flex items-center gap-1 text-xs text-white/75">
                  <TrendingUp className="h-3.5 w-3.5" />
                  {todaySalesCount} {saleWord}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl bg-white/15 p-4 backdrop-blur-sm">
            <p className="text-xs text-white/80">{t("dashboard.yourSpace")}</p>
            <p className="text-lg font-bold">{primaryLabel}</p>
            <p className="mt-1 text-xs text-white/75">{moduleCountLabel}</p>
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3">
          {hasCommerce ? (
            <>
              <Link
                href="/sales"
                className="flex items-center justify-center gap-2 rounded-2xl bg-wazo-orange px-4 py-3.5 text-sm font-bold text-white shadow-lg transition active:scale-[0.98] hover:brightness-105"
              >
                <ShoppingBag className="h-4 w-4" />
                {t("hero.cashier")}
              </Link>
              <Link
                href="/products/add"
                className="flex items-center justify-center gap-2 rounded-2xl bg-white/20 px-4 py-3.5 text-sm font-bold text-white backdrop-blur-sm transition active:scale-[0.98] hover:bg-white/30"
              >
                <Plus className="h-4 w-4" />
                {t("nav.add")}
              </Link>
            </>
          ) : (
            <>
              <Link
                href={primary.addPath ?? primary.path}
                className="flex items-center justify-center gap-2 rounded-2xl bg-wazo-orange px-4 py-3.5 text-sm font-bold text-white shadow-lg transition active:scale-[0.98] hover:brightness-105"
              >
                <PrimaryIcon className="h-4 w-4" />
                {t("hero.start")}
              </Link>
              <Link
                href={primary.path}
                className="flex items-center justify-center gap-2 rounded-2xl bg-white/20 px-4 py-3.5 text-sm font-bold text-white backdrop-blur-sm transition active:scale-[0.98] hover:bg-white/30"
              >
                <PrimaryIcon className="h-4 w-4" />
                {t("hero.open")}
              </Link>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
