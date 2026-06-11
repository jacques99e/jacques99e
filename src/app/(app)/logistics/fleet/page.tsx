"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Fuel, Truck, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { localStore } from "@/lib/db";
import { listDeliveries } from "@/lib/logistics";
import {
  addDriver,
  assignDelivery,
  estimateFuelCost,
  readAssignments,
  readDrivers,
} from "@/lib/fleet-pulse";
import { formatCurrency } from "@/lib/utils";
import type { Delivery } from "@/types";

export default function FleetPage() {
  const store = localStore.get();
  const storeId = store?.id;
  const [drivers, setDrivers] = useState(() => readDrivers(storeId));
  const [assignments, setAssignments] = useState(() => readAssignments(storeId));
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicle, setVehicle] = useState("Moto");
  const [kmEstimates, setKmEstimates] = useState<Record<string, string>>({});

  useEffect(() => {
    if (store) void listDeliveries(store.id).then(setDeliveries);
  }, [store]);

  const activeDeliveries = deliveries.filter(
    (d) => d.status !== "delivered" && d.status !== "cancelled"
  );

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setDrivers(
      addDriver(
        { name: name.trim(), phone: phone.trim(), vehicle, fuelPricePerKm: 85, active: true },
        storeId
      )
    );
    setName("");
    setPhone("");
  };

  const assign = (deliveryId: string, driverId: string) => {
    const km = Number(kmEstimates[deliveryId] || 12);
    setAssignments(assignDelivery(deliveryId, driverId, km, storeId));
  };

  const totalFuelToday = assignments.reduce((sum, a) => sum + estimateFuelCost(a.estimatedKm), 0);

  return (
    <div className="min-h-screen bg-[#F5F5F0] pb-24">
      <header className="bg-sky-900 px-4 py-4 text-white">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <Truck className="h-5 w-5" /> Fleet Pulse
          </h1>
          <Link href="/logistics"><ArrowLeft className="h-4 w-4" /></Link>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 p-4">
        <div className="rounded-2xl bg-sky-50 p-4">
          <div className="flex items-center gap-2 text-sky-900">
            <Fuel className="h-5 w-5" />
            <p className="text-sm font-semibold">Carburant estimé tournée : {formatCurrency(totalFuelToday)}</p>
          </div>
          <p className="mt-1 text-xs text-sky-700">Base 85 FCFA/km — ajustable par chauffeur</p>
        </div>

        <form onSubmit={add} className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold">Ajouter chauffeur</h2>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom" required />
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Téléphone" />
          <Input value={vehicle} onChange={(e) => setVehicle(e.target.value)} placeholder="Véhicule" />
          <Button type="submit" className="w-full"><UserPlus className="mr-1 h-4 w-4" /> Enregistrer</Button>
        </form>

        {drivers.length > 0 ? (
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold">Équipe ({drivers.length})</h2>
            <ul className="space-y-1 text-xs">
              {drivers.map((d) => (
                <li key={d.id} className="rounded bg-gray-50 p-2">
                  {d.name} — {d.vehicle} ({d.phone || "sans tel"})
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold">Affecter colis</h2>
          {activeDeliveries.length === 0 ? (
            <p className="text-xs text-gray-500">Aucune livraison active.</p>
          ) : (
            <ul className="space-y-3">
              {activeDeliveries.map((d) => (
                <li key={d.id} className="rounded-lg border p-3 text-xs">
                  <p className="font-medium">{d.recipient_name} — {d.tracking_code}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px]">Km estimés</Label>
                      <Input
                        type="number"
                        min="1"
                        value={kmEstimates[d.id] ?? "12"}
                        onChange={(e) =>
                          setKmEstimates((prev) => ({ ...prev, [d.id]: e.target.value }))
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-[10px]">Chauffeur</Label>
                      <select
                        className="w-full rounded border px-2 py-1.5"
                        onChange={(e) => assign(d.id, e.target.value)}
                        defaultValue=""
                      >
                        <option value="" disabled>Choisir…</option>
                        {drivers.map((drv) => (
                          <option key={drv.id} value={drv.id}>{drv.name}</option>
                        ))}
                      </select>
                    </div>
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
