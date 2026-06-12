"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { Camera } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api-client";
import { readLocalProducts, writeLocalProducts } from "@/lib/local-products";
import { PLAN_LIMITS, normalizeBillingStatus, type BillingSubscription } from "@/lib/billing";
import { billingUpgradeHref } from "@/lib/billing-checkout";

type ProductCategory =
  | "Alimentation"
  | "Boissons"
  | "Beauté"
  | "Vêtements"
  | "Électronique"
  | "Agriculture"
  | "Autre";

const categories: ProductCategory[] = [
  "Alimentation",
  "Boissons",
  "Beauté",
  "Vêtements",
  "Électronique",
  "Agriculture",
  "Autre",
];

export default function AddProductPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const initialCategory = (searchParams.get("category") as ProductCategory) || "Alimentation";
  const [category, setCategory] = useState<ProductCategory>(initialCategory);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [billing, setBilling] = useState<BillingSubscription | null>(null);

  useEffect(() => {
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
        // Keep fallback behavior in offline mode.
      }
    };
    void loadBilling();
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (billing && normalizeBillingStatus(billing) === "expired") {
        setError("Votre abonnement est expire. Activez un plan pour continuer.");
        return;
      }

      const maxProducts = billing ? PLAN_LIMITS[billing.plan].maxProducts : PLAN_LIMITS.starter.maxProducts;
      const existing = readLocalProducts();
      if (existing.length >= maxProducts) {
        setError(`Limite atteinte (${maxProducts} produits). Passez a un plan superieur.`);
        return;
      }

      const product = {
        id: `prod-${Date.now()}`,
        name: name.trim(),
        description: description.trim(),
        price: Number(price),
        stock: Number(quantity),
        stock_quantity: Number(quantity),
        category,
        createdAt: new Date().toISOString(),
      };

      writeLocalProducts([...existing, product]);
      router.push("/products?success=1");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <AppHeader title="Ajouter un produit" />
      <main className="mx-auto max-w-lg p-4">
        <form onSubmit={handleSave} className="space-y-4 rounded-2xl bg-white p-4 shadow-sm">
          <div>
            <Label>Nom du produit</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Ex: Riz parfumé 5kg"
              className="mt-1"
            />
          </div>

          <div>
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description du produit"
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Prix en FCFA</Label>
              <Input
                type="number"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label>Quantité en stock</Label>
              <Input
                type="number"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label>Catégorie</Label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ProductCategory)}
              className="mt-1 flex h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label>Photo du produit</Label>
            <label className="mt-1 flex h-28 w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 text-gray-500">
              <Camera className="h-6 w-6" />
              <span className="mt-1 text-xs">Prendre une photo ou uploader (placeholder)</span>
              <input type="file" accept="image/*" className="hidden" />
            </label>
          </div>

          <Button
            type="submit"
            className="h-12 w-full bg-[#FF6F00] text-white hover:opacity-90"
            disabled={loading}
          >
            {loading ? "Enregistrement..." : "Enregistrer le produit"}
          </Button>
          {error ? (
            <p className="text-xs text-red-600">
              {error}{" "}
              <Link href={billingUpgradeHref(billing)} className="font-semibold underline">
                Payer maintenant
              </Link>
            </p>
          ) : null}
        </form>
      </main>
    </>
  );
}

