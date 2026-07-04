"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocalizedMarketPrices } from "@/hooks/useLocalizedMarketPrices";
import { apiFetch } from "@/lib/api-client";
import { PLAN_LIMITS, normalizeBillingStatus, type BillingSubscription } from "@/lib/billing";
import { billingUpgradeHref } from "@/lib/billing-checkout";
import { useAuth } from "@/hooks/useAuth";
import { localStore } from "@/lib/db";
import { getProducts, saveProduct, uploadProductImage } from "@/lib/products";
import { formatCurrency } from "@/lib/utils";

const CROP_LABELS: Record<string, string> = {
  riz: "Riz",
  maïs: "Maïs",
  mil: "Mil",
  manioc: "Manioc",
  arachide: "Arachide",
  coton: "Coton",
  cacao: "Cacao",
  café: "Café",
  maraîcher: "Légumes",
  autre: "Récolte",
};

const CROP_TO_PRICE_ID: Record<string, string> = {
  riz: "riz",
  maïs: "mais",
  manioc: "manioc",
  cacao: "cacao",
  café: "cafe",
  arachide: "anacarde",
};

export default function SellHarvestPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { prices, loading: pricesLoading } = useLocalizedMarketPrices();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("Récolte agricole");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [billing, setBilling] = useState<BillingSubscription | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");

  const priceSuggestions = useMemo(
    () => prices.map((p) => ({ id: p.id, label: p.product, price: p.priceFcfa, unit: p.unit })),
    [prices]
  );

  useEffect(() => {
    void apiFetch("/api/billing/subscription", { cache: "no-store" })
      .then(async (res) => {
        const data = (await res.json()) as { success: boolean; subscription?: BillingSubscription };
        if (res.ok && data.success && data.subscription) setBilling(data.subscription);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("wazo_cultures");
      if (!raw) return;
      const cultures = JSON.parse(raw) as Array<{ cropType?: string; name?: string }>;
      const harvest = cultures.find((c) => c.cropType);
      if (!harvest?.cropType) return;

      const cropLabel = CROP_LABELS[harvest.cropType] ?? harvest.cropType;
      setName(harvest.name?.trim() ? `${cropLabel} — ${harvest.name}` : cropLabel);

      const priceId = CROP_TO_PRICE_ID[harvest.cropType];
      if (priceId && prices.length) {
        const match = prices.find((p) => p.id === priceId);
        if (match) setPrice(String(match.priceFcfa));
      }
    } catch {
      /* ignore */
    }
  }, [prices]);

  const applySuggestion = (suggestedPrice: number, label: string) => {
    if (!name.trim()) setName(label);
    setPrice(String(suggestedPrice));
  };

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
        setError("Votre abonnement est expiré. Activez un plan pour continuer.");
        return;
      }

      const maxProducts = billing ? PLAN_LIMITS[billing.plan].maxProducts : PLAN_LIMITS.starter.maxProducts;
      const existing = await getProducts(storeId);
      if (existing.length >= maxProducts) {
        setError(`Limite atteinte (${maxProducts} produits). Passez à un plan supérieur.`);
        return;
      }

      let image_url: string | null = null;
      if (imageFile && navigator.onLine && user?.id) {
        image_url = await uploadProductImage(user.id, imageFile);
      }

      await saveProduct(storeId, {
        name: name.trim(),
        description: description.trim() || "Récolte agricole",
        price: Number(price),
        stock_quantity: Number(quantity),
        barcode: null,
        image_url,
        is_active: true,
      });

      router.push("/agriculture?harvestListed=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <AppHeader title="Vendre ma récolte" />
      <main className="mx-auto max-w-lg space-y-4 p-4">
        <Link href="/agriculture" className="inline-flex items-center gap-2 text-sm text-[#8B7355]">
          <ArrowLeft className="h-4 w-4" /> Agriculture
        </Link>

        {!pricesLoading && priceSuggestions.length > 0 ? (
          <div className="rounded-xl bg-emerald-50 p-3">
            <p className="text-xs font-medium text-emerald-900">Prix du marché local</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {priceSuggestions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => applySuggestion(s.price, s.label)}
                  className="rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-medium text-emerald-800 shadow-sm"
                >
                  {s.label} · {formatCurrency(s.price)}/{s.unit}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <form onSubmit={handleSave} className="space-y-4 rounded-2xl bg-white p-4 shadow-sm">
          <div>
            <Label>Produit / récolte</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Ex: Riz paddy"
              className="mt-1"
            />
          </div>

          <div>
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Origine, qualité, conditionnement…"
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Prix (FCFA / unité)</Label>
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
              <Label>Quantité disponible</Label>
              <Input
                type="number"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                placeholder="kg ou unités"
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label>Photo (optionnel)</Label>
            <label className="mt-1 flex h-28 w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 text-gray-500">
              {imagePreviewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imagePreviewUrl} alt="" className="h-full w-full rounded-xl object-cover" />
              ) : (
                <Camera className="h-6 w-6" />
              )}
              <span className="mt-1 text-xs">{imagePreviewUrl ? "Photo prête" : "Ajouter une photo"}</span>
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
            className="h-12 w-full bg-[#8B7355] text-white hover:opacity-90"
            disabled={loading}
          >
            {loading ? "Publication…" : "Mettre en vente"}
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
