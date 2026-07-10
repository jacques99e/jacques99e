"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Copy, CreditCard, Megaphone, Package, Pencil, Plus, Search } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { downloadCsv, downloadSimplePdf } from "@/lib/export";
import { type LocalProduct } from "@/lib/local-products";
import { ModuleCompetitiveEdge } from "@/components/ModuleCompetitiveEdge";
import { ModuleMenuLink } from "@/components/ModuleMenuLink";
import { ModulePublicPortals } from "@/components/ModulePublicPortals";
import { ProductLandingButton } from "@/components/ProductLandingButton";
import { buildWhatsAppCatalog } from "@/lib/commerce-catalog";
import { buildWhatsAppShareUrl } from "@/lib/whatsapp-share";
import { localStore } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";
import { getProducts, saveProduct } from "@/lib/products";
import { reconcileProductsWithCloud } from "@/lib/product-reconcile";
import type { Product } from "@/types";

export default function ProductsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState<"all" | "low" | "out">("all");
  const [sortBy, setSortBy] = useState<"name" | "price" | "stock">("name");
  const [showSuccess, setShowSuccess] = useState(false);
  const [persistError, setPersistError] = useState("");
  const [syncMessage, setSyncMessage] = useState("");
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const store = localStore.get();
    setStoreId(store?.id ?? null);
  }, []);

  useEffect(() => {
    setShowSuccess(searchParams.get("success") === "1");
  }, [searchParams]);

  useEffect(() => {
    if (!storeId) return;
    let cancelled = false;

    const load = async () => {
      try {
        const result = await reconcileProductsWithCloud(storeId);
        const rows = await getProducts(storeId);
        if (cancelled) return;
        setProducts(rows);
        if (result.pushed > 0) {
          setSyncMessage(`${result.pushed} produit(s) synchronisé(s) vers la boutique en ligne.`);
        } else if (result.errors.length > 0) {
          setSyncMessage(result.errors[0]);
        }
      } catch {
        // Keep UI usable even if sync fails.
      }
    };

    void load();
    const interval = setInterval(() => void load(), 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [storeId]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let next = products.filter((p) => p.name.toLowerCase().includes(q));
    if (stockFilter === "low") {
      next = next.filter((p) => (p.stock_quantity ?? 0) > 0 && (p.stock_quantity ?? 0) <= 5);
    } else if (stockFilter === "out") {
      next = next.filter((p) => (p.stock_quantity ?? 0) <= 0);
    }
    const sorted = [...next];
    if (sortBy === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === "price") sorted.sort((a, b) => b.price - a.price);
    if (sortBy === "stock") sorted.sort((a, b) => (b.stock_quantity ?? 0) - (a.stock_quantity ?? 0));
    return sorted;
  }, [products, search, stockFilter, sortBy]);

  const stockValue = (p: Product) => p.stock_quantity ?? 0;
  const toLocalProduct = (p: Product): LocalProduct => ({
    id: p.id,
    name: p.name,
    description: p.description ?? undefined,
    price: p.price,
    stock: p.stock_quantity ?? 0,
    stock_quantity: p.stock_quantity ?? 0,
    category: "Autre",
    createdAt: p.created_at,
  });

  const duplicateProduct = async (product: Product) => {
    if (!storeId) return;
    setPersistError("");
    try {
      const copy = await saveProduct(storeId, {
        name: `${product.name} (copie)`,
        description: product.description ?? null,
        price: product.price,
        stock_quantity: stockValue(product),
        barcode: product.barcode,
        image_url: product.image_url,
        is_active: true,
      });
      setProducts((prev) => [copy, ...prev]);
    } catch {
      setPersistError("Erreur lors de la duplication du produit.");
    }
  };

  const updateStock = async (productId: string, delta: number) => {
    if (!storeId) return;
    setPersistError("");
    const current = products.find((p) => p.id === productId);
    if (!current) return;

    const original = current;
    const updated = Math.max(0, stockValue(original) + delta);

    setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, stock_quantity: updated } : p)));
    try {
      const saved = await saveProduct(storeId, {
        id: original.id,
        name: original.name,
        description: original.description ?? null,
        price: original.price,
        stock_quantity: updated,
        barcode: original.barcode,
        image_url: original.image_url,
        is_active: original.is_active,
      });
      setProducts((prev) => prev.map((p) => (p.id === productId ? saved : p)));
    } catch {
      setPersistError("Erreur lors de la mise à jour du stock.");
      setProducts((prev) => prev.map((p) => (p.id === productId ? original : p)));
    }
  };

  const runStoreSync = async () => {
    if (!storeId) return;
    setSyncing(true);
    setSyncMessage("");
    setPersistError("");
    try {
      const result = await reconcileProductsWithCloud(storeId);
      const rows = await getProducts(storeId);
      setProducts(rows);
      if (result.pushed > 0) {
        setSyncMessage(`${result.pushed} produit(s) publié(s) sur la boutique en ligne.`);
      } else if (result.errors.length > 0) {
        setPersistError(result.errors.join(" "));
      } else if (rows.length === 0) {
        setSyncMessage("Aucun produit local à synchroniser. Ajoutez un produit puis réessayez.");
      } else {
        setSyncMessage("Catalogue déjà à jour en ligne.");
      }
    } catch (err) {
      setPersistError(err instanceof Error ? err.message : "Synchronisation impossible.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <>
      <AppHeader
        title="Produits"
        right={
          <Link href="/products/add">
            <Plus className="h-5 w-5 text-white" />
          </Link>
        }
      />
      <main className="app-page animate-fade-in pb-24">
        {showSuccess && (
          <p className="rounded-xl bg-green-50 p-3 text-sm text-green-700 shadow-sm">
            Produit enregistré avec succès.
          </p>
        )}
        {persistError ? (
          <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 shadow-sm">
            {persistError}
          </p>
        ) : null}
        {syncMessage ? (
          <p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-800 shadow-sm">{syncMessage}</p>
        ) : null}
        <div className="flex justify-end">
          <Button type="button" variant="outline" size="sm" disabled={syncing} onClick={() => void runStoreSync()}>
            {syncing ? "Synchronisation…" : "Publier sur la boutique"}
          </Button>
        </div>

        <ModulePublicPortals moduleId="commerce" />
        <ModuleCompetitiveEdge moduleId="commerce" />

        <ModuleMenuLink
          href="/products/orders"
          icon={Package}
          title="Commandes COD"
          description="Paiement à la livraison — confirmer, livrer, WhatsApp client"
          iconClassName="bg-[#FF6F00]/10 text-[#FF6F00]"
        />
        <ModuleMenuLink
          href="/sales/credit"
          icon={CreditCard}
          title="Carnet crédit clients"
          description="Dettes, acomptes et relance WhatsApp"
          iconClassName="bg-wazo-green/10 text-wazo-green"
        />
        <ModuleMenuLink
          href="/sales/promotions"
          icon={Megaphone}
          title="Promotions flash"
          description="Réductions % appliquées à la caisse + partage WhatsApp"
          iconClassName="bg-orange-500/10 text-orange-700"
        />

        <Button
          type="button"
          variant="outline"
          className="w-full border-[#25D366] text-[#128C7E]"
          onClick={() => {
            const store = localStore.get();
            const boutiqueUrl =
              store?.slug && typeof window !== "undefined"
                ? `${window.location.origin}/boutique/${store.slug}`
                : undefined;
            const text = buildWhatsAppCatalog({
              storeName: store?.name || "Ma boutique",
              products: filtered.map(toLocalProduct),
              boutiqueUrl,
            });
            window.open(buildWhatsAppShareUrl(text), "_blank", "noopener,noreferrer");
          }}
          disabled={filtered.length === 0}
        >
          Partager catalogue WhatsApp
        </Button>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un produit"
            className="pl-9"
          />
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="app-card p-3">
            <p className="text-xl font-bold text-wazo-green">{products.length}</p>
            <p className="mt-0.5 text-gray-500">Total</p>
          </div>
          <div className="app-card p-3">
            <p className="text-xl font-bold text-amber-600">
              {products.filter((p) => stockValue(p) <= 5 && stockValue(p) > 0).length}
            </p>
            <p className="mt-0.5 text-gray-500">Stock bas</p>
          </div>
          <div className="app-card p-3">
            <p className="text-xl font-bold text-red-600">
              {products.filter((p) => stockValue(p) <= 0).length}
            </p>
            <p className="mt-0.5 text-gray-500">Rupture</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value as "all" | "low" | "out")}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          >
            <option value="all">Tous stocks</option>
            <option value="low">Stock bas</option>
            <option value="out">Rupture</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "name" | "price" | "stock")}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          >
            <option value="name">Tri: nom</option>
            <option value="price">Tri: prix</option>
            <option value="stock">Tri: stock</option>
          </select>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button
            variant="outline"
            onClick={() =>
              downloadCsv(
                `produits-${new Date().toISOString().slice(0, 10)}.csv`,
                filtered.map((p) => ({
                  id: p.id,
                  nom: p.name,
                  categorie: "Autre",
                  prix: p.price,
                  stock: stockValue(p),
                }))
              )
            }
          >
            Export CSV
          </Button>
          <Button
            variant="outline"
            onClick={async () =>
              downloadSimplePdf(
                "Inventaire Produits",
                filtered.map(
                  (p) =>
                    `${p.name} | Autre | ${formatCurrency(p.price)} | Stock ${stockValue(p)}`
                ),
                `inventaire-${new Date().toISOString().slice(0, 10)}.pdf`
              )
            }
          >
            Export PDF
          </Button>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
            <p className="text-gray-500">Aucun produit pour le moment</p>
            <Button asChild variant="orange" className="mt-4 w-full bg-[#FF6F00] hover:opacity-90">
              <Link href="/products/add">Ajouter votre premier produit</Link>
            </Button>
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map((p) => (
              <li key={p.id} className="app-list-item">
                <div className="flex items-center gap-3">
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt="" className="h-14 w-14 rounded-lg object-cover" />
                  ) : (
                    <div className="h-14 w-14 rounded-lg bg-gray-200" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-gray-900">{p.name}</p>
                    <p className="text-sm text-[#075E54]">{formatCurrency(p.price)}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                      <span>Stock: {stockValue(p)}</span>
                      <button
                        type="button"
                        onClick={() => void updateStock(p.id, -1)}
                        className="rounded border px-1.5 hover:bg-gray-100"
                        aria-label={`Diminuer le stock de ${p.name}`}
                      >
                        -1
                      </button>
                      <button
                        type="button"
                        onClick={() => void updateStock(p.id, 1)}
                        className="rounded border px-1.5 hover:bg-gray-100"
                        aria-label={`Augmenter le stock de ${p.name}`}
                      >
                        +1
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${
                        stockValue(p) <= 0
                          ? "bg-red-100 text-red-700"
                          : stockValue(p) <= 5
                            ? "bg-amber-100 text-amber-700"
                            : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {p.barcode ?? "Produit"}
                    </span>
                    <button
                      type="button"
                      onClick={() => router.push(`/products/${encodeURIComponent(p.id)}`)}
                      className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700 hover:bg-gray-200"
                    >
                      <Pencil className="h-3 w-3" />
                      Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => void duplicateProduct(p)}
                      className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700 hover:bg-gray-200"
                    >
                      <Copy className="h-3 w-3" />
                      Dupliquer
                    </button>
                    {storeId ? (
                      <ProductLandingButton
                        storeId={storeId}
                        product={p}
                        onUpdated={(description) => {
                          setProducts((prev) =>
                            prev.map((row) =>
                              row.id === p.id ? { ...row, description } : row
                            )
                          );
                        }}
                      />
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <Button asChild className="w-full" variant="orange">
          <Link href="/products/add">
            <Plus className="h-4 w-4" />
            Ajouter un produit
          </Link>
        </Button>
      </main>
    </>
  );
}
