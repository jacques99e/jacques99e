"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  GraduationCap,
  HeartPulse,
  Leaf,
  Package,
  ShoppingBag,
  Store,
  Truck,
  AlertCircle,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { localStore } from "@/lib/db";

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

export default function DashboardPage() {
  const router = useRouter();
  const { user, supabase } = useAuth();
  const [storeName, setStoreName] = useState("Votre boutique");
  const [offlineInfo, setOfflineInfo] = useState("");
  const [todayTotal, setTodayTotal] = useState(0);
  const [todaySalesCount, setTodaySalesCount] = useState(0);
  const [totalStock, setTotalStock] = useState(0);
  const [differentProductsCount, setDifferentProductsCount] = useState(0);
  const [outOfStockCount, setOutOfStockCount] = useState(0);
  const [latestSales, setLatestSales] = useState<LocalSale[]>([]);
  const [popularProducts, setPopularProducts] = useState<Array<{ name: string; sold: number }>>([]);

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
    const salesRaw = localStorage.getItem("wazo_sales");
    const products = productsRaw ? (JSON.parse(productsRaw) as LocalProduct[]) : [];
    const sales = salesRaw ? (JSON.parse(salesRaw) as LocalSale[]) : [];

    const getStock = (p: LocalProduct) => p.stock ?? p.stock_quantity ?? 0;
    const getSaleDate = (s: LocalSale) => s.date || s.created_at || "";
    const getSaleTotal = (s: LocalSale) => Number(s.total ?? s.total_amount ?? 0);

    const today = new Date().toISOString().slice(0, 10);
    const salesToday = sales.filter((sale) => getSaleDate(sale).slice(0, 10) === today);
    setTodaySalesCount(salesToday.length);
    setTodayTotal(salesToday.reduce((sum, sale) => sum + getSaleTotal(sale), 0));

    setDifferentProductsCount(products.length);
    setTotalStock(products.reduce((sum, product) => sum + getStock(product), 0));
    setOutOfStockCount(products.filter((product) => getStock(product) <= 0).length);

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
    return () => {
      cancelled = true;
    };
  }, [user, supabase, router]);

  return (
    <div className="min-h-screen bg-[#F5F5F0] pb-24">
      <header className="bg-[#075E54] px-4 py-4 text-white shadow-sm">
        <div className="mx-auto max-w-lg">
          <h1 className="text-lg font-semibold">Bonjour, {storeName}</h1>
          {offlineInfo && <p className="mt-1 text-xs text-white/80">{offlineInfo}</p>}
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 p-4">
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-gray-600">
              <ShoppingBag className="h-4 w-4 text-[#075E54]" />
              <span className="text-sm font-semibold">Ventes du jour</span>
            </div>
            <p className="text-2xl font-bold text-[#075E54]">{formatCurrency(todayTotal)}</p>
            <p className="text-xs text-gray-500">{todaySalesCount} vente(s)</p>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-gray-600">
              <Store className="h-4 w-4 text-[#075E54]" />
              <span className="text-sm font-semibold">Produits en stock</span>
            </div>
            <p className="text-2xl font-bold text-[#075E54]">{totalStock}</p>
            <p className="text-xs text-gray-500">{differentProductsCount} produit(s) différent(s)</p>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm sm:col-span-2">
            <div className="mb-2 flex items-center gap-2 text-gray-600">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <span className="text-sm font-semibold">Produits en rupture</span>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold text-[#075E54]">{outOfStockCount}</p>
              {outOfStockCount > 0 && <span className="h-2.5 w-2.5 rounded-full bg-red-500" />}
            </div>
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

        <Button asChild variant="orange" className="h-12 w-full bg-[#FF6F00] hover:opacity-90">
          <Link href="/products/add">Ajouter un produit</Link>
        </Button>
        <Button asChild className="h-12 w-full bg-[#075E54] hover:opacity-90">
          <Link href="/sales">Aller à la caisse</Link>
        </Button>

        <p className="rounded-xl bg-white p-4 text-sm text-gray-700 shadow-sm">
          Bienvenue sur Wazo Digital ! Commencez par ajouter votre premier produit.
        </p>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Modules</h2>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="flex flex-col items-center gap-1 rounded-xl bg-gray-50 p-3 text-center">
              <Package className="h-5 w-5 text-[#075E54]" />
              <span>Commerce</span>
            </div>
            <Link href="/agriculture" className="flex flex-col items-center gap-1 rounded-xl bg-gray-50 p-3 text-center">
              <Leaf className="h-5 w-5 text-[#075E54]" />
              <span>🌾 Agriculture</span>
            </Link>
            <div className="flex flex-col items-center gap-1 rounded-xl bg-gray-50 p-3 text-center">
              <HeartPulse className="h-5 w-5 text-[#075E54]" />
              <span>Santé</span>
            </div>
            <div className="flex flex-col items-center gap-1 rounded-xl bg-gray-50 p-3 text-center">
              <Truck className="h-5 w-5 text-[#075E54]" />
              <span>Logistique</span>
            </div>
            <div className="flex flex-col items-center gap-1 rounded-xl bg-gray-50 p-3 text-center">
              <GraduationCap className="h-5 w-5 text-[#075E54]" />
              <span>Éducation</span>
            </div>
            <div className="rounded-xl bg-gray-50 p-3 text-center text-gray-400">+</div>
          </div>
        </section>
      </main>
    </div>
  );
}
