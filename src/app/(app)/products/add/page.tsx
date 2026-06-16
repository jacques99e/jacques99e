"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api-client";
import { PLAN_LIMITS, normalizeBillingStatus, type BillingSubscription } from "@/lib/billing";
import { billingUpgradeHref } from "@/lib/billing-checkout";
import { useAuth } from "@/hooks/useAuth";
import { localStore } from "@/lib/db";
import { getProducts, saveProduct, uploadProductImage } from "@/lib/products";

export default function AddProductPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [billing, setBilling] = useState<BillingSubscription | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>("");
  const { user } = useAuth();

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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const storeId = localStore.get()?.id;
      if (!storeId) {
        setError("Boutique introuvable. Reconnectez-vous.");
        return;
      }

      if (billing && normalizeBillingStatus(billing) === "expired") {
        setError("Votre abonnement est expire. Activez un plan pour continuer.");
        return;
      }

      const maxProducts = billing ? PLAN_LIMITS[billing.plan].maxProducts : PLAN_LIMITS.starter.maxProducts;
      const existing = await getProducts(storeId);
      if (existing.length >= maxProducts) {
        setError(`Limite atteinte (${maxProducts} produits). Passez a un plan superieur.`);
        return;
      }

      let image_url: string | null = null;
      if (imageFile) {
        if (!user?.id) {
          setError("Connexion requise pour enregistrer la photo.");
          return;
        }
        if (navigator.onLine) {
          image_url = await uploadProductImage(user.id, imageFile);
        }
      }

      await saveProduct(storeId, {
        id: `prod-${Date.now()}`,
        name: name.trim(),
        description: description.trim() || null,
        price: Number(price),
        stock_quantity: Number(quantity),
        barcode: null,
        image_url,
        is_active: true,
      });

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
            <Label>Photo du produit</Label>
            <label className="mt-1 flex h-28 w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 text-gray-500">
              {imagePreviewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imagePreviewUrl} alt="" className="h-full w-full rounded-xl object-cover" />
              ) : (
                <Camera className="h-6 w-6" />
              )}
              <span className="mt-1 text-xs">{imagePreviewUrl ? "Photo prete" : "Uploader une photo"}</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setImageFile(file);
                  setImagePreviewUrl(URL.createObjectURL(file));
                }}
              />
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

