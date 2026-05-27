"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const regionalAverage = 2500; // mock kg/ha

export default function YieldCalculatorPage() {
  const [harvestKg, setHarvestKg] = useState("");
  const [areaHa, setAreaHa] = useState("");
  const [computed, setComputed] = useState<number | null>(null);

  const advice = useMemo(() => {
    if (computed === null) return "";
    if (computed >= regionalAverage) {
      return "Excellent rendement ! Continuez vos bonnes pratiques agricoles.";
    }
    if (computed >= regionalAverage * 0.75) {
      return "Bon résultat. Vous pouvez encore optimiser les intrants et l'irrigation.";
    }
    return "Rendement en dessous de la moyenne. Vérifiez la fertilisation et le calendrier cultural.";
  }, [computed]);

  const calculate = (e: React.FormEvent) => {
    e.preventDefault();
    const harvest = Number(harvestKg);
    const area = Number(areaHa);
    if (harvest > 0 && area > 0) {
      setComputed(Math.round((harvest / area) * 100) / 100);
    } else {
      setComputed(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F0] pb-24">
      <header className="bg-[#075E54] px-4 py-4 text-white shadow-sm">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <h1 className="text-lg font-semibold">Calculateur de rendement</h1>
          <Link href="/agriculture" className="text-sm text-white/90">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 p-4">
        <form onSubmit={calculate} className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
          <div>
            <Label>Quantité récoltée (kg)</Label>
            <Input
              type="number"
              min="0"
              value={harvestKg}
              onChange={(e) => setHarvestKg(e.target.value)}
              required
              className="mt-1"
            />
          </div>
          <div>
            <Label>Superficie (hectares)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={areaHa}
              onChange={(e) => setAreaHa(e.target.value)}
              required
              className="mt-1"
            />
          </div>
          <Button type="submit" className="w-full bg-[#8B7355] hover:opacity-90">
            Calculer le rendement
          </Button>
        </form>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-600">Rendement moyen régional (mock)</p>
          <p className="text-xl font-bold text-[#8B7355]">{regionalAverage} kg/ha</p>
        </section>

        {computed !== null && (
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-600">Votre rendement</p>
            <p className="text-2xl font-bold text-[#075E54]">{computed} kg/ha</p>
            <p className="mt-2 text-sm text-gray-700">{advice}</p>
          </section>
        )}
      </main>
    </div>
  );
}

