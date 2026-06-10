"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { localStore } from "@/lib/db";
import {
  addPharmacyItem,
  expiringSoon,
  lowStockItems,
  readPharmacyStock,
  updatePharmacyQuantity,
} from "@/lib/health-pharmacy";

export default function PharmacyPage() {
  const storeId = localStore.get()?.id;
  const [items, setItems] = useState(() => readPharmacyStock(storeId));
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("10");
  const [unit, setUnit] = useState("boîtes");
  const [minStock, setMinStock] = useState("5");
  const [expiryDate, setExpiryDate] = useState("");

  const low = useMemo(() => lowStockItems(items), [items]);
  const expiring = useMemo(() => expiringSoon(items), [items]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setItems(
      addPharmacyItem(
        {
          name: name.trim(),
          quantity: Number(quantity) || 0,
          unit: unit.trim() || "unités",
          minStock: Number(minStock) || 5,
          expiryDate: expiryDate || null,
          note: "",
        },
        storeId
      )
    );
    setName("");
  };

  return (
    <div className="min-h-screen bg-[#F5F5F0] pb-24">
      <header className="bg-rose-700 px-4 py-4 text-white shadow-sm">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <h1 className="text-lg font-semibold">Mini pharmacie</h1>
          <Link href="/health" className="text-sm text-white/90">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 p-4">
        {(low.length > 0 || expiring.length > 0) && (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2 text-amber-800">
              <AlertTriangle className="h-4 w-4" />
              <h2 className="text-sm font-semibold">Alertes</h2>
            </div>
            {low.length > 0 ? (
              <p className="mt-1 text-xs text-amber-900">
                Stock bas : {low.map((i) => i.name).join(", ")}
              </p>
            ) : null}
            {expiring.length > 0 ? (
              <p className="mt-1 text-xs text-amber-900">
                Expiration proche : {expiring.map((i) => i.name).join(", ")}
              </p>
            ) : null}
          </section>
        )}

        <form onSubmit={submit} className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold">Ajouter un médicament</h2>
          <div>
            <Label>Nom</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Quantité</Label>
              <Input type="number" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <div>
              <Label>Unité</Label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Seuil alerte</Label>
              <Input type="number" min="0" value={minStock} onChange={(e) => setMinStock(e.target.value)} />
            </div>
            <div>
              <Label>Expiration</Label>
              <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
            </div>
          </div>
          <Button type="submit" className="w-full">
            <Plus className="mr-1 h-4 w-4" /> Ajouter
          </Button>
        </form>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold">Stock ({items.length})</h2>
          {items.length === 0 ? (
            <p className="text-xs text-gray-500">Aucun médicament enregistré.</p>
          ) : (
            <ul className="space-y-2">
              {items.map((item) => (
                <li key={item.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-gray-500">
                      {item.quantity} {item.unit}
                      {item.expiryDate ? ` — exp. ${item.expiryDate}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setItems(updatePharmacyQuantity(item.id, -1, storeId))}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setItems(updatePharmacyQuantity(item.id, 1, storeId))}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
