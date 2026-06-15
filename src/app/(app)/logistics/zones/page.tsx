"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MapPin, Plus, Trash2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { localStore } from "@/lib/db";
import {
  addDeliveryZone,
  deleteDeliveryZone,
  listDeliveryZones,
  type DeliveryZone,
} from "@/lib/logistics-zones";
import { formatCurrency } from "@/lib/utils";

export default function LogisticsZonesPage() {
  const store = localStore.get();
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [name, setName] = useState("");
  const [fee, setFee] = useState(1000);
  const [eta, setEta] = useState(24);
  const [lookup, setLookup] = useState("");
  const [estimate, setEstimate] = useState<DeliveryZone | null>(null);

  const refresh = () => {
    if (store?.id) setZones(listDeliveryZones(store.id));
  };

  useEffect(() => {
    refresh();
  }, [store?.id]);

  const submit = () => {
    if (!store?.id || !name.trim()) return;
    addDeliveryZone(store.id, {
      name: name.trim(),
      fee: Math.max(0, fee),
      eta_hours: Math.max(1, eta),
    });
    setName("");
    refresh();
  };

  const checkEstimate = () => {
    if (!store?.id) return;
    const q = lookup.trim().toLowerCase();
    setEstimate(
      zones.find((z) => z.name.toLowerCase() === q) ??
        zones.find((z) => q.includes(z.name.toLowerCase())) ??
        null
    );
  };

  if (!store) return <p className="p-4 text-sm">Boutique non configurée.</p>;

  return (
    <>
      <AppHeader title="Zones & tarifs" subtitle="Logistique" />
      <main className="app-page space-y-4 pb-6">
        <p className="text-xs text-gray-600">
          Définissez vos quartiers ou villes avec un tarif fixe et un délai estimé pour vos
          livreurs et clients.
        </p>

        <section className="app-card space-y-3 p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <MapPin className="h-4 w-4 text-sky-700" />
            Nouvelle zone
          </h2>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Plateau, Ouaga centre…" />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Frais livraison (FCFA)</Label>
              <Input type="number" min={0} value={fee} onChange={(e) => setFee(Number(e.target.value))} className="mt-1" />
            </div>
            <div>
              <Label>Délai (heures)</Label>
              <Input type="number" min={1} value={eta} onChange={(e) => setEta(Number(e.target.value))} className="mt-1" />
            </div>
          </div>
          <Button className="w-full" onClick={submit} disabled={!name.trim()}>
            <Plus className="mr-1 h-4 w-4" />
            Ajouter la zone
          </Button>
        </section>

        <section className="app-card space-y-2 p-4">
          <h2 className="text-sm font-semibold">Estimer un tarif</h2>
          <div className="flex gap-2">
            <Input value={lookup} onChange={(e) => setLookup(e.target.value)} placeholder="Nom de zone" />
            <Button type="button" variant="outline" onClick={checkEstimate}>
              Calculer
            </Button>
          </div>
          {estimate ? (
            <p className="text-sm text-[#075E54]">
              {estimate.name} : {formatCurrency(estimate.fee)} — ~{estimate.eta_hours}h
            </p>
          ) : lookup ? (
            <p className="text-xs text-gray-500">Zone non trouvée — créez-la ci-dessus.</p>
          ) : null}
        </section>

        <ul className="space-y-2">
          {zones.map((z) => (
            <li key={z.id} className="app-card flex items-center justify-between p-3">
              <div>
                <p className="font-medium">{z.name}</p>
                <p className="text-xs text-gray-500">
                  {formatCurrency(z.fee)} · ~{z.eta_hours}h
                </p>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="text-red-600"
                onClick={() => {
                  deleteDeliveryZone(store.id, z.id);
                  refresh();
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>

        <Link href="/logistics" className="block text-center text-xs text-gray-500">
          ← Logistique
        </Link>
      </main>
    </>
  );
}
