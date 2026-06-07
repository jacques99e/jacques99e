"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Copy, Pencil, Plus, Search } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { downloadCsv, downloadSimplePdf } from "@/lib/export";
import { readLocalProducts, type LocalProduct, writeLocalProducts } from "@/lib/local-products";
import { ModulePublicPortals } from "@/components/ModulePublicPortals";
import { buildWhatsAppCatalog } from "@/lib/commerce-catalog";
import { buildWhatsAppShareUrl } from "@/lib/module-local-tools";
import { localStore } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";

export default function ProductsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<LocalProduct[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState<"all" | "low" | "out">("all");
  const [sortBy, setSortBy] = useState<"name" | "price" | "stock">("name");
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    setProducts(readLocalProducts());
    setShowSuccess(searchParams.get("success") === "1");
  }, [searchParams]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let next = products.filter((p) => p.name.toLowerCase().includes(q));
    if (categoryFilter !== "all") {
      next = next.filter((p) => (p.category ?? "Autre") === categoryFilter);
    }
    if (stockFilter === "low") {
      next = next.filter((p) => p.stock > 0 && p.stock <= 5);
    } else if (stockFilter === "out") {
      next = next.filter((p) => p.stock <= 0);
    }
    const sorted = [...next];
    if (sortBy === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === "price") sorted.sort((a, b) => b.price - a.price);
    if (sortBy === "stock") sorted.sort((a, b) => b.stock - a.stock);
    return sorted;
  }, [products, search, categoryFilter, stockFilter, sortBy]);

  const categories = useMemo(() => {
    const values = [...new Set(products.map((p) => p.category ?? "Autre"))];
    return values.sort((a, b) => a.localeCompare(b));
  }, [products]);

  const stockValue = (p: LocalProduct) => p.stock ?? p.stock_quantity ?? 0;

  const duplicateProduct = (product: LocalProduct) => {
    const copy: LocalProduct = {
      ...product,
      id: `prod-${Date.now()}`,
      name: `${product.name} (copie)`,
      stock: stockValue(product),
      stock_quantity: stockValue(product),
      createdAt: new Date().toISOString(),
    };
    const next = [copy, ...products];
    setProducts(next);
    writeLocalProducts(next);
  };

  const updateStock = (productId: string, delta: number) => {
    const next = products.map((product) => {
      if (product.id !== productId) return product;
      const current = stockValue(product);
      const updated = Math.max(0, current + delta);
      return { ...product, stock: updated, stock_quantity: updated };
    });
    setProducts(next);
    writeLocalProducts(next);
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

        <ModulePublicPortals moduleId="commerce" />

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
              products: filtered,
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

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          >
            <option value="all">Toutes catégories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
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
                  categorie: p.category ?? "Autre",
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
                    `${p.name} | ${p.category ?? "Autre"} | ${formatCurrency(p.price)} | Stock ${stockValue(p)}`
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
                  <div className="h-14 w-14 rounded-lg bg-gray-200" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-gray-900">{p.name}</p>
                    <p className="text-sm text-[#075E54]">{formatCurrency(p.price)}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                      <span>Stock: {stockValue(p)}</span>
                      <button
                        type="button"
                        onClick={() => updateStock(p.id, -1)}
                        className="rounded border px-1.5 hover:bg-gray-100"
                        aria-label={`Diminuer le stock de ${p.name}`}
                      >
                        -1
                      </button>
                      <button
                        type="button"
                        onClick={() => updateStock(p.id, 1)}
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
                      {p.category ?? "Autre"}
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
                      onClick={() => duplicateProduct(p)}
                      className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700 hover:bg-gray-200"
                    >
                      <Copy className="h-3 w-3" />
                      Dupliquer
                    </button>
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
