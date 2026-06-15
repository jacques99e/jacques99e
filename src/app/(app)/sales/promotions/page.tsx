"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Megaphone, Plus, Trash2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { localStore } from "@/lib/db";
import {
  activePromotions,
  addPromotion,
  deletePromotion,
  listPromotions,
  updatePromotion,
  type CommercePromotion,
} from "@/lib/commerce-promotions";
import { readLocalProducts } from "@/lib/local-products";
import { buildWhatsAppShareUrl } from "@/lib/whatsapp-share";
import { formatCurrency } from "@/lib/utils";

export default function PromotionsPage() {
  const store = localStore.get();
  const [rows, setRows] = useState<CommercePromotion[]>([]);
  const [label, setLabel] = useState("");
  const [percent, setPercent] = useState(10);
  const [endsAt, setEndsAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });

  const refresh = () => {
    if (store?.id) setRows(listPromotions(store.id));
  };

  useEffect(() => {
    refresh();
  }, [store?.id]);

  const products = useMemo(() => readLocalProducts(), []);

  const sharePromo = (promo: CommercePromotion) => {
    const text = `🔥 ${promo.label} — ${promo.discount_percent}% de réduction chez ${store?.name || "notre boutique"} jusqu'au ${promo.ends_at}. Passez commande !`;
    window.open(buildWhatsAppShareUrl(text), "_blank", "noopener,noreferrer");
  };

  const create = () => {
    if (!store?.id || !label.trim()) return;
    addPromotion(store.id, {
      label: label.trim(),
      discount_percent: Math.min(90, Math.max(1, percent)),
      product_ids: [],
      ends_at: endsAt,
      active: true,
    });
    setLabel("");
    refresh();
  };

  if (!store) {
    return <p className="p-4 text-sm text-gray-500">Boutique non configurée.</p>;
  }

  const active = activePromotions(store.id);

  return (
    <>
      <AppHeader title="Promotions flash" subtitle="Commerce" />
      <main className="app-page space-y-4 pb-6">
        <p className="text-xs text-gray-600">
          Réductions appliquées automatiquement à la caisse sur tous les produits (ou sélectionnez
          des produits plus tard). Partagez la promo sur WhatsApp en un clic.
        </p>

        {active.length > 0 ? (
          <section className="rounded-xl border border-orange-200 bg-orange-50 p-3 text-xs text-orange-900">
            <Megaphone className="mb-1 inline h-4 w-4" /> {active.length} promotion(s) active(s)
            — visible à la caisse.
          </section>
        ) : null}

        <section className="app-card space-y-3 p-4">
          <h2 className="text-sm font-semibold">Nouvelle promotion</h2>
          <div>
            <Label>Nom de l&apos;offre</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex: Soldes week-end"
              className="mt-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Réduction (%)</Label>
              <Input
                type="number"
                min={1}
                max={90}
                value={percent}
                onChange={(e) => setPercent(Number(e.target.value))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Fin (date)</Label>
              <Input
                type="date"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <p className="text-[10px] text-gray-500">
            Exemple : produit à {formatCurrency(10000)} →{" "}
            {formatCurrency(Math.round(10000 * (1 - percent / 100)))} avec -{percent}%
          </p>
          <Button className="w-full" onClick={create} disabled={!label.trim()}>
            <Plus className="mr-1 h-4 w-4" />
            Créer la promotion
          </Button>
        </section>

        <ul className="space-y-2">
          {rows.map((promo) => (
            <li key={promo.id} className="app-card space-y-2 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{promo.label}</p>
                  <p className="text-xs text-gray-500">
                    -{promo.discount_percent}% · jusqu&apos;au {promo.ends_at}
                    {promo.active ? " · active" : " · pause"}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => sharePromo(promo)}
                  >
                    WhatsApp
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="text-red-600"
                    onClick={() => {
                      deletePromotion(store.id, promo.id);
                      refresh();
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={promo.active}
                  onChange={(e) => {
                    updatePromotion(store.id, { ...promo, active: e.target.checked });
                    refresh();
                  }}
                />
                Active à la caisse
              </label>
            </li>
          ))}
        </ul>

        {products.length === 0 ? (
          <p className="text-xs text-amber-700">
            Ajoutez des produits pour que les promotions s&apos;appliquent à la caisse.
          </p>
        ) : null}

        <Link href="/sales" className="block text-center text-xs text-gray-500">
          ← Retour caisse
        </Link>
      </main>
    </>
  );
}
