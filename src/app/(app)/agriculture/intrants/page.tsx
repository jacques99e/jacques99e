"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type InputType = "engrais" | "pesticides" | "eau";

interface CulturePlot {
  id: string;
  name: string;
}

interface FarmInputEntry {
  id: string;
  type: InputType;
  name: string;
  quantity: number;
  date: string;
  plotId: string;
  plotName: string;
}

export default function InputsPage() {
  const [type, setType] = useState<InputType>("engrais");
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [plotId, setPlotId] = useState("");

  const plots = useMemo(() => {
    const raw = localStorage.getItem("wazo_cultures");
    const data = raw ? (JSON.parse(raw) as CulturePlot[]) : [];
    return data;
  }, []);

  const [entries, setEntries] = useState<FarmInputEntry[]>(() => {
    const raw = localStorage.getItem("wazo_intrants");
    return raw ? (JSON.parse(raw) as FarmInputEntry[]) : [];
  });

  const saveEntries = (next: FarmInputEntry[]) => {
    setEntries(next);
    localStorage.setItem("wazo_intrants", JSON.stringify(next));
  };

  const addEntry = (e: React.FormEvent) => {
    e.preventDefault();
    const plot = plots.find((p) => p.id === plotId);
    const entry: FarmInputEntry = {
      id: `intrant-${Date.now()}`,
      type,
      name: name.trim(),
      quantity: Number(quantity),
      date,
      plotId: plotId || "none",
      plotName: plot?.name || "Non précisée",
    };
    saveEntries([entry, ...entries]);
    setType("engrais");
    setName("");
    setQuantity("");
    setDate(new Date().toISOString().slice(0, 10));
    setPlotId("");
  };

  return (
    <div className="min-h-screen bg-[#F5F5F0] pb-24">
      <header className="bg-[#075E54] px-4 py-4 text-white shadow-sm">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <h1 className="text-lg font-semibold">Journal des intrants</h1>
          <Link href="/agriculture" className="text-sm text-white/90">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 p-4">
        <form onSubmit={addEntry} className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
          <div>
            <Label>Type d'intrant</Label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as InputType)}
              className="mt-1 flex h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm"
            >
              <option value="engrais">Engrais</option>
              <option value="pesticides">Pesticides</option>
              <option value="eau">Eau</option>
            </select>
          </div>
          <div>
            <Label>Nom</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required className="mt-1" />
          </div>
          <div>
            <Label>Quantité</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
              className="mt-1"
            />
          </div>
          <div>
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="mt-1" />
          </div>
          <div>
            <Label>Parcelle concernée</Label>
            <select
              value={plotId}
              onChange={(e) => setPlotId(e.target.value)}
              className="mt-1 flex h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm"
            >
              <option value="">Sélectionner</option>
              {plots.map((plot) => (
                <option key={plot.id} value={plot.id}>
                  {plot.name}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" className="w-full bg-[#8B7355] hover:opacity-90">
            Ajouter au journal
          </Button>
        </form>

        <section className="space-y-2">
          {entries.map((entry) => (
            <article key={entry.id} className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="font-semibold capitalize text-gray-900">
                {entry.type} • {entry.name}
              </p>
              <p className="text-sm text-gray-600">
                {entry.quantity} • {entry.plotName}
              </p>
              <p className="text-xs text-gray-500">{new Date(entry.date).toLocaleDateString("fr-FR")}</p>
            </article>
          ))}
          {entries.length === 0 && (
            <p className="rounded-xl bg-white p-4 text-sm text-gray-500 shadow-sm">
              Aucun intrant enregistré pour le moment.
            </p>
          )}
        </section>
      </main>
    </div>
  );
}

