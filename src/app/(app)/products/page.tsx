"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { readLocalProducts, type LocalProduct } from "@/lib/local-products";
import { formatCurrency } from "@/lib/utils";

export default function ProductsPage() {
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<LocalProduct[]>([]);
  const [search, setSearch] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    setProducts(readLocalProducts());
    setShowSuccess(searchParams.get("success") === "1");
  }, [searchParams]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, search]);

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
      <main className="mx-auto max-w-lg space-y-3 p-4 pb-24">
        {showSuccess && (
          <p className="rounded-xl bg-green-50 p-3 text-sm text-green-700 shadow-sm">
            Produit enregistré avec succès.
          </p>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un produit"
            className="pl-9"
          />
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
              <li key={p.id} className="rounded-2xl bg-white p-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="h-14 w-14 rounded-lg bg-gray-200" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-gray-900">{p.name}</p>
                    <p className="text-sm text-[#075E54]">{formatCurrency(p.price)}</p>
                    <p className="text-xs text-gray-500">Stock restant: {p.stock}</p>
                  </div>
                  <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700">
                    {p.category}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}

        <Link
          href="/products/add"
          className="fixed bottom-24 right-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#FF6F00] text-white shadow-lg"
          aria-label="Ajouter un produit"
        >
          <Plus className="h-6 w-6" />
        </Link>
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
