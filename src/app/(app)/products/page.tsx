"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronDown,
  Copy,
  CreditCard,
  Megaphone,
  Package,
  Pencil,
  Plus,
  Search,
} from "lucide-react";
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
  const [showTools, setShowTools] = useState(false);

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

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un produit"
            className="h-12 pl-9"
          />
        </div>

        <div className="flex items-center gap-3 text-center text-xs">
          <div className="min-w-0 flex-1">
            <p className="text-lg font-extrabold tracking-tight text-wazo-green">{products.length}</p>
            <p className="text-gray-500">Total</p>
          </div>
          <div className="h-8 w-px bg-gray-200" />
          <div className="min-w-0 flex-1">
            <p className="text-lg font-extrabold tracking-tight text-amber-600">
              {products.filter((p) => stockValue(p) <= 5 && stockValue(p) > 0).length}
            </p>
            <p className="text-gray-500">Stock bas</p>
          </div>
          <div className="h-8 w-px bg-gray-200" />
          <div className="min-w-0 flex-1">
            <p className="text-lg font-extrabold tracking-tight text-red-600">
              {products.filter((p) => stockValue(p) <= 0).length}
            </p>
            <p className="text-gray-500">Rupture</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value as "all" | "low" | "out")}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
          >
            <option value="all">Tous stocks</option>
            <option value="low">Stock bas</option>
            <option value="out">Rupture</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "name" | "price" | "stock")}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
          >
            <option value="name">Tri: nom</option>
            <option value="price">Tri: prix</option>
            <option value="stock">Tri: stock</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" size="sm" disabled={syncing} onClick={() => void runStoreSync()}>
            {syncing ? "Sync…" : "Publier boutique"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-[#25D366] text-[#128C7E]"
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
            WhatsApp
          </Button>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-wazo-green/25 bg-white px-6 py-10 text-center shadow-sm">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-wazo-green/10 text-wazo-green">
              <Package className="h-7 w-7" />
            </div>
            <p className="text-base font-bold text-gray-900">
              {products.length === 0 ? "Votre catalogue est vide" : "Aucun résultat"}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {products.length === 0
                ? "Ajoutez un produit avec photo pour vendre plus vite."
                : "Essayez un autre filtre ou une autre recherche."}
            </p>
            {products.length === 0 ? (
              <Button asChild variant="orange" className="mt-5 w-full">
                <Link href="/products/add">Ajouter votre premier produit</Link>
              </Button>
            ) : null}
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3">
            {filtered.map((p) => {
              const stock = stockValue(p);
              const stockTone =
                stock <= 0
                  ? "bg-red-500"
                  : stock <= 5
                    ? "bg-amber-500"
                    : "bg-wazo-green";
              return (
                <li
                  key={p.id}
                  className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:shadow-wazo"
                >
                  <button
                    type="button"
                    onClick={() => router.push(`/products/${encodeURIComponent(p.id)}`)}
                    className="block w-full text-left"
                  >
                    <div className="relative aspect-square bg-gradient-to-br from-gray-100 to-gray-50">
                      {p.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.image_url}
                          alt={p.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-gray-400">
                          <Package className="h-8 w-8" />
                          <span className="text-[10px] font-medium">Sans photo</span>
                        </div>
                      )}
                      <span
                        className={`absolute left-2 top-2 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-white ${stockTone}`}
                      >
                        Stock {stock}
                      </span>
                    </div>
                    <div className="space-y-1 p-3">
                      <p className="line-clamp-2 text-sm font-bold leading-snug text-gray-900">
                        {p.name}
                      </p>
                      <p className="text-base font-extrabold tracking-tight text-wazo-green">
                        {formatCurrency(p.price)}
                      </p>
                    </div>
                  </button>
                  <div className="flex items-center gap-1 border-t border-gray-50 px-2 py-2">
                    <button
                      type="button"
                      onClick={() => void updateStock(p.id, -1)}
                      className="flex h-8 flex-1 items-center justify-center rounded-lg bg-gray-50 text-sm font-semibold text-gray-700 active:bg-gray-100"
                      aria-label={`Diminuer le stock de ${p.name}`}
                    >
                      −
                    </button>
                    <button
                      type="button"
                      onClick={() => void updateStock(p.id, 1)}
                      className="flex h-8 flex-1 items-center justify-center rounded-lg bg-gray-50 text-sm font-semibold text-gray-700 active:bg-gray-100"
                      aria-label={`Augmenter le stock de ${p.name}`}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push(`/products/${encodeURIComponent(p.id)}`)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-50"
                      aria-label={`Modifier ${p.name}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void duplicateProduct(p)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-50"
                      aria-label={`Dupliquer ${p.name}`}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {storeId ? (
                    <div className="border-t border-gray-50 px-2 pb-2">
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
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        <Button asChild className="w-full" variant="orange">
          <Link href="/products/add">
            <Plus className="h-4 w-4" />
            Ajouter un produit
          </Link>
        </Button>

        <button
          type="button"
          onClick={() => setShowTools((v) => !v)}
          className="flex w-full items-center justify-between rounded-2xl border border-gray-100 bg-white px-4 py-3 text-left text-sm font-semibold text-gray-700 shadow-sm"
        >
          <span>{showTools ? "Masquer les outils" : "Outils (commandes, crédit, export…)"}</span>
          <ChevronDown
            className={`h-4 w-4 text-gray-400 transition-transform ${showTools ? "rotate-180" : ""}`}
          />
        </button>

        {showTools ? (
          <div className="space-y-3 animate-fade-in">
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
            <div className="grid grid-cols-2 gap-2">
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
          </div>
        ) : null}
      </main>
    </>
  );
}
