"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Store, AlertCircle, BarChart3, Blocks } from "lucide-react";
import { getOrderedActiveModules, MODULE_LABELS, MODULES } from "@/lib/modules/config";
import { AppHeader } from "@/components/AppHeader";
import { DashboardHero } from "@/components/DashboardHero";
import { ModuleDashboardStats } from "@/components/ModuleDashboardStats";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { getTrialDaysLeft, normalizeBillingStatus, type BillingSubscription } from "@/lib/billing";
import { apiFetch } from "@/lib/api-client";
import { formatCurrency } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useAlerts } from "@/hooks/useAlerts";
import { useModule } from "@/hooks/useModule";
import { notifyAlertsChanged } from "@/lib/alerts";
import { getLowStockThreshold } from "@/lib/business-settings";
import {
  BUSINESS_VERTICAL_LABELS,
  ONBOARDING_VERTICAL_ORDER,
  type BusinessVertical,
  getBusinessVertical,
  getOnboardingProgress,
  inferVerticalFromModules,
  setBusinessVertical,
  setTaskDone,
} from "@/lib/onboarding";
import { downloadWeeklyReportPdf } from "@/lib/weekly-report";
import { localStore } from "@/lib/db";
import { readLocalSales } from "@/lib/local-sales";

interface LocalProduct {
  id: string;
  name: string;
  stock?: number;
  stock_quantity?: number;
}

interface LocalSaleItem {
  name?: string;
  product_name?: string;
  quantity: number;
}

interface LocalSale {
  id: string;
  items: LocalSaleItem[];
  total?: number;
  total_amount?: number;
  date?: string;
  created_at?: string;
}

interface LocalClient {
  id: string;
  nextFollowUp: string | null;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, supabase } = useAuth();
  const cachedStore = localStore.get();
  const { modules: activeModules, primaryModule } = useModule(cachedStore?.id);
  const dashboardModules = getOrderedActiveModules(activeModules);
  const hasCommerce = activeModules.includes("commerce");
  const statsModules = hasCommerce
    ? activeModules.filter((m) => m !== "commerce")
    : activeModules;
  const visibleVerticals = ONBOARDING_VERTICAL_ORDER.filter((v) => activeModules.includes(v));
  const { summary: alerts } = useAlerts();
  const [storeName, setStoreName] = useState("Votre boutique");
  const [offlineInfo, setOfflineInfo] = useState("");
  const [todayTotal, setTodayTotal] = useState(0);
  const [todaySalesCount, setTodaySalesCount] = useState(0);
  const [totalStock, setTotalStock] = useState(0);
  const [differentProductsCount, setDifferentProductsCount] = useState(0);
  const [outOfStockCount, setOutOfStockCount] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [lowStockProducts, setLowStockProducts] = useState<Array<{ id: string; name: string; stock: number }>>([]);
  const [weekTotal, setWeekTotal] = useState(0);
  const [weekSalesCount, setWeekSalesCount] = useState(0);
  const [avgBasket, setAvgBasket] = useState(0);
  const [latestSales, setLatestSales] = useState<LocalSale[]>([]);
  const [popularProducts, setPopularProducts] = useState<Array<{ name: string; sold: number }>>([]);
  const greeting = storeName || "Ma boutique";
  const [businessVertical, setBusinessVerticalState] = useState<BusinessVertical>(() =>
    getBusinessVertical()
  );
  const [onboardingTick, setOnboardingTick] = useState(0);
  const [billing, setBilling] = useState<BillingSubscription | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  const onboarding = getOnboardingProgress(businessVertical);

  useEffect(() => {
    if (!activeModules.length) return;
    const inferred = inferVerticalFromModules(activeModules);
    const current = getBusinessVertical();
    if (!activeModules.includes(current)) {
      setBusinessVertical(inferred);
      setBusinessVerticalState(inferred);
    }
  }, [activeModules]);

  useEffect(() => {
    let cancelled = false;
    const initStore = async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from("stores")
          .select("*")
          .eq("owner_id", user.id)
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        if (cancelled) return;
        if (!data) {
          router.replace("/setup");
          return;
        }
        setStoreName(data.name || "Votre boutique");
        localStorage.setItem("store_name", data.name || "");
        localStorage.setItem("store_slug", data.slug || "");
        localStorage.setItem("store_setup_complete", "true");
        localStore.save(data);
      } catch {
        if (cancelled) return;
        const localName = localStorage.getItem("store_name");
        if (localName?.trim()) {
          setStoreName(localName);
        }
        setOfflineInfo("Mode hors ligne - données locales");
      }
    };
    void initStore();

    const productsRaw = localStorage.getItem("wazo_products");
    const products = productsRaw ? (JSON.parse(productsRaw) as LocalProduct[]) : [];
    const storeId = localStore.get()?.id;
    const sales = readLocalSales(storeId || undefined) as LocalSale[];
    const clientsRaw = localStorage.getItem(
      storeId ? `wazo_clients_${storeId}` : "wazo_clients"
    );
    void (clientsRaw ? (JSON.parse(clientsRaw) as LocalClient[]) : []);

    const getStock = (p: LocalProduct) => p.stock ?? p.stock_quantity ?? 0;
    const getSaleDate = (s: LocalSale) => s.date || s.created_at || "";
    const getSaleTotal = (s: LocalSale) => Number(s.total ?? s.total_amount ?? 0);

    const today = new Date().toISOString().slice(0, 10);
    const salesToday = sales.filter((sale) => getSaleDate(sale).slice(0, 10) === today);
    setTodaySalesCount(salesToday.length);
    setTodayTotal(salesToday.reduce((sum, sale) => sum + getSaleTotal(sale), 0));

    const todayDate = new Date();
    const weekStart = new Date(todayDate);
    weekStart.setDate(todayDate.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);
    const weeklySales = sales.filter((sale) => {
      const raw = getSaleDate(sale);
      if (!raw) return false;
      const d = new Date(raw);
      return !Number.isNaN(d.getTime()) && d >= weekStart && d <= todayDate;
    });
    const weeklyTotal = weeklySales.reduce((sum, sale) => sum + getSaleTotal(sale), 0);
    setWeekTotal(weeklyTotal);
    setWeekSalesCount(weeklySales.length);
    setAvgBasket(weeklySales.length > 0 ? weeklyTotal / weeklySales.length : 0);

    setDifferentProductsCount(products.length);
    setTotalStock(products.reduce((sum, product) => sum + getStock(product), 0));
    setOutOfStockCount(products.filter((product) => getStock(product) <= 0).length);
    const stockThreshold = getLowStockThreshold();
    const lowStock = products
      .map((product) => ({ id: product.id, name: product.name, stock: getStock(product) }))
      .filter((product) => product.stock > 0 && product.stock <= stockThreshold)
      .sort((a, b) => a.stock - b.stock);
    setLowStockCount(lowStock.length);
    setLowStockProducts(lowStock.slice(0, 5));

    const sortedLatest = [...sales].sort((a, b) => {
      return new Date(getSaleDate(b)).getTime() - new Date(getSaleDate(a)).getTime();
    });
    setLatestSales(sortedLatest.slice(0, 5));

    const soldByProduct = new Map<string, number>();
    sales.forEach((sale) => {
      (sale.items || []).forEach((item) => {
        const name = item.name || item.product_name || "Produit";
        const qty = Number(item.quantity || 0);
        soldByProduct.set(name, (soldByProduct.get(name) || 0) + qty);
      });
    });
    const topProducts = [...soldByProduct.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, sold]) => ({ name, sold }));
    setPopularProducts(topProducts);

    notifyAlertsChanged();

    const loadBilling = async () => {
      try {
        const response = await apiFetch("/api/billing/subscription", { cache: "no-store" });
        const data = (await response.json()) as {
          success: boolean;
          subscription?: BillingSubscription;
        };
        if (response.ok && data.success && data.subscription) {
          setBilling(data.subscription);
        }
      } catch {
        // Dashboard continues in local/offline mode.
      }
    };
    void loadBilling();
    return () => {
      cancelled = true;
    };
  }, [user, supabase, router]);

  const selectVertical = (vertical: BusinessVertical) => {
    setBusinessVertical(vertical);
    setBusinessVerticalState(vertical);
    setOnboardingTick((n) => n + 1);
  };

  const toggleTask = (taskId: string, done: boolean) => {
    setTaskDone(taskId, done);
    setOnboardingTick((n) => n + 1);
  };

  const doneCount = onboarding.done;

  return (
    <>
      <AppHeader title={greeting} subtitle="Tableau de bord" />
      <main className="app-page animate-fade-in pb-6">
        <DashboardHero
          storeName={greeting}
          activeModules={activeModules}
          primaryModule={primaryModule}
          todayTotal={todayTotal}
          todaySalesCount={todaySalesCount}
        />
        {offlineInfo ? (
          <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-700">{offlineInfo}</p>
        ) : null}
        {(hasCommerce && alerts.total > 0) ? (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-red-800">Alertes actives ({alerts.total})</h2>
            <ul className="mt-2 space-y-1 text-xs text-red-700">
              {alerts.stockAlerts > 0 ? (
                <li>
                  Stock: {alerts.outOfStock} rupture(s), {alerts.lowStock} stock faible
                </li>
              ) : null}
              {alerts.clientAlerts > 0 ? (
                <li>
                  Clients: {alerts.followUpsToday} relance(s) aujourd&apos;hui, {alerts.followUpsOverdue} en retard
                </li>
              ) : null}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              {alerts.stockAlerts > 0 ? (
                <Link href="/products" className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-red-800">
                  Gerer le stock
                </Link>
              ) : null}
              {alerts.clientAlerts > 0 ? (
                <Link href="/clients" className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-red-800">
                  Traiter les relances
                </Link>
              ) : null}
            </div>
          </section>
        ) : null}
        {billing ? (
          <section
            className={`rounded-2xl p-3 text-xs shadow-sm ${
              normalizeBillingStatus(billing) === "expired"
                ? "bg-red-50 text-red-700"
                : normalizeBillingStatus(billing) === "trial"
                  ? "bg-amber-50 text-amber-700"
                  : "bg-green-50 text-green-700"
            }`}
          >
            <p className="font-semibold">Abonnement: {billing.plan.toUpperCase()}</p>
            <p>
              {normalizeBillingStatus(billing) === "expired"
                ? "Essai expire. Activez un plan pour eviter les limitations."
                : normalizeBillingStatus(billing) === "trial"
                  ? `Essai gratuit en cours (${getTrialDaysLeft(billing)} jour(s) restants).`
                  : `Abonnement actif jusqu'au ${billing.current_period_end ?? "-"}.`}
            </p>
            <Link href="/billing" className="mt-1 inline-block underline">
              Gerer l'abonnement
            </Link>
          </section>
        ) : null}
        <section className="rounded-2xl bg-white p-4 shadow-sm" key={onboardingTick}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Onboarding métier</h2>
            <span className="text-xs font-semibold text-[#075E54]">
              {doneCount}/{onboarding.total}
            </span>
          </div>
          <p className="mb-2 text-xs text-gray-500">
            {visibleVerticals.length > 1
              ? "Choisissez votre activité principale :"
              : "Votre parcours de démarrage :"}
          </p>
          {visibleVerticals.length > 1 ? (
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {visibleVerticals.map((vertical) => (
              <button
                key={vertical}
                type="button"
                onClick={() => selectVertical(vertical)}
                className={`rounded-lg px-2 py-2 text-[11px] font-medium leading-tight ${
                  businessVertical === vertical
                    ? "bg-[#075E54] text-white"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                {BUSINESS_VERTICAL_LABELS[vertical]}
              </button>
            ))}
          </div>
          ) : null}
          <div className="space-y-2 text-xs">
            {onboarding.tasks.map((task) => (
              <label key={task.id} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={Boolean(onboarding.progress[task.id])}
                  onChange={(e) => toggleTask(task.id, e.target.checked)}
                />
                <span>
                  <Link href={task.href} className="font-medium text-[#075E54] underline">
                    {task.label}
                  </Link>
                </span>
              </label>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {hasCommerce ? (
              <Link href="/clients" className="rounded-lg bg-gray-50 px-3 py-2 text-xs hover:bg-gray-100">
                Ouvrir mini CRM
              </Link>
            ) : null}
            <Link href="/help" className="rounded-lg bg-gray-50 px-3 py-2 text-xs hover:bg-gray-100">
              Centre d'aide
            </Link>
            <Link href="/billing" className="rounded-lg bg-gray-50 px-3 py-2 text-xs hover:bg-gray-100">
              Abonnement
            </Link>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-auto py-2 text-xs"
              disabled={reportLoading}
              onClick={() => {
                setReportLoading(true);
                void downloadWeeklyReportPdf(storeName).finally(() => setReportLoading(false));
              }}
            >
              {reportLoading ? "PDF..." : "Rapport hebdo PDF"}
            </Button>
          </div>
        </section>
        {hasCommerce ? (
          <>
            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <StatCard
                icon={Store}
                label="Stock total"
                value={String(totalStock)}
                hint={`${differentProductsCount} produit(s) différent(s)`}
              />
              <StatCard
                icon={BarChart3}
                label="7 derniers jours"
                value={formatCurrency(weekTotal)}
                hint={`${weekSalesCount} vente(s) · panier ${formatCurrency(avgBasket)}`}
                accent="sky"
              />

              <div className="app-card p-4 sm:col-span-2">
                <div className="mb-2 flex items-center gap-2 text-gray-600">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm font-semibold">Produits en rupture</span>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold text-[#075E54]">{outOfStockCount}</p>
                  {outOfStockCount > 0 && <span className="h-2.5 w-2.5 rounded-full bg-red-500" />}
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {lowStockCount} produit(s) avec stock faible (seuil: {getLowStockThreshold()} unites)
                </p>
                {lowStockProducts.length > 0 ? (
                  <ul className="mt-2 space-y-1 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
                    {lowStockProducts.map((p) => (
                      <li key={p.id} className="flex items-center justify-between">
                        <span>{p.name}</span>
                        <span className="font-semibold">{p.stock} restant(s)</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <Link
                  href="/products"
                  className="mt-2 inline-block rounded-lg bg-gray-50 px-3 py-2 text-xs hover:bg-gray-100"
                >
                  Reapprovisionner les produits
                </Link>
              </div>
            </section>

            <section className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-gray-700">
                <BarChart3 className="h-4 w-4 text-[#075E54]" />
                <h2 className="text-sm font-semibold">Dernières ventes</h2>
              </div>
              {latestSales.length === 0 ? (
                <p className="text-sm text-gray-500">Aucune vente réalisée pour le moment</p>
              ) : (
                <ul className="space-y-2">
                  {latestSales.map((sale) => {
                    const saleDate = sale.date || sale.created_at || "";
                    const saleItemsCount = (sale.items || []).reduce(
                      (sum, item) => sum + Number(item.quantity || 0),
                      0
                    );
                    const amount = Number(sale.total ?? sale.total_amount ?? 0);
                    return (
                      <li key={sale.id} className="flex items-center justify-between rounded-xl bg-gray-50 p-3">
                        <div>
                          <p className="text-xs text-gray-500">
                            {saleDate
                              ? new Date(saleDate).toLocaleString("fr-FR")
                              : "Date inconnue"}
                          </p>
                          <p className="text-sm font-medium">{saleItemsCount} article(s)</p>
                        </div>
                        <p className="text-sm font-bold text-[#075E54]">{formatCurrency(amount)}</p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="rounded-2xl bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-gray-700">Produits populaires</h2>
              {popularProducts.length === 0 ? (
                <p className="text-sm text-gray-500">Faites votre première vente pour voir les statistiques</p>
              ) : (
                <ul className="space-y-2">
                  {popularProducts.map((product) => (
                    <li key={product.name} className="flex items-center justify-between rounded-xl bg-gray-50 p-3">
                      <span className="text-sm font-medium">{product.name}</span>
                      <span className="text-xs font-semibold text-[#075E54]">{product.sold} vendu(s)</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        ) : null}

        {statsModules.length > 0 && cachedStore ? (
          <ModuleDashboardStats storeId={cachedStore.id} modules={statsModules} />
        ) : null}

        <section className="app-card p-4">
          <h2 className="mb-3 text-sm font-bold text-gray-800">Modules</h2>
          <div className="grid grid-cols-3 gap-2.5 text-xs">
            {dashboardModules.map((moduleId) => {
              const config = MODULES[moduleId];
              const Icon = config.icon;
              return (
                <Link
                  key={moduleId}
                  href={config.path}
                  className="group flex flex-col items-center gap-2 rounded-2xl border border-gray-100 bg-gradient-to-b from-white to-gray-50/80 p-3 text-center transition hover:border-wazo-green/25 hover:shadow-wazo"
                >
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-sm ${config.color}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="font-medium leading-tight text-gray-700 group-hover:text-wazo-green">
                    {MODULE_LABELS[moduleId]}
                  </span>
                </Link>
              );
            })}
            <Link
              href="/modules"
              className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-200 p-3 text-center text-gray-400 transition hover:border-wazo-green/30 hover:text-wazo-green"
              title="Gérer les modules"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100">
                <Blocks className="h-5 w-5" />
              </div>
              <span className="font-medium">Plus</span>
            </Link>
          </div>
        </section>

        {dashboardModules.length > 0 ? (
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Actions rapides</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {dashboardModules.map((moduleId) => {
              const mod = MODULES[moduleId];
              const to = mod.addPath ?? mod.path;
              return (
                <Link
                  key={moduleId}
                  href={to}
                  className="rounded-xl border border-[#075E54]/20 bg-[#075E54]/5 px-3 py-2 text-sm font-medium text-[#075E54] transition hover:bg-[#075E54]/10"
                >
                  {MODULE_LABELS[moduleId]}: créer
                </Link>
              );
            })}
          </div>
        </section>
        ) : null}
      </main>
    </>
  );
}
