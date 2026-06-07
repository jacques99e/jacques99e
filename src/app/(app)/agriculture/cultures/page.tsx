"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CultureType =
  | "riz"
  | "maïs"
  | "mil"
  | "manioc"
  | "arachide"
  | "coton"
  | "cacao"
  | "café"
  | "maraîcher"
  | "autre";

type CultureStage = "préparation" | "semis" | "croissance" | "floraison" | "récolte";

interface CulturePlot {
  id: string;
  name: string;
  area: number;
  cropType: CultureType;
  sowingDate: string;
  stage: CultureStage;
}

const cropTypes: CultureType[] = [
  "riz",
  "maïs",
  "mil",
  "manioc",
  "arachide",
  "coton",
  "cacao",
  "café",
  "maraîcher",
  "autre",
];

const stages: CultureStage[] = ["préparation", "semis", "croissance", "floraison", "récolte"];

function stageProgress(stage: CultureStage): number {
  return ((stages.indexOf(stage) + 1) / stages.length) * 100;
}

export default function CulturesPage() {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [cropType, setCropType] = useState<CultureType>("riz");
  const [sowingDate, setSowingDate] = useState(new Date().toISOString().slice(0, 10));
  const [stage, setStage] = useState<CultureStage>("préparation");
  const [cropFilter, setCropFilter] = useState<CultureType | "all">("all");
  const [stageFilter, setStageFilter] = useState<CultureStage | "all">("all");
  const [plots, setPlots] = useState<CulturePlot[]>(() => {
    const raw = localStorage.getItem("wazo_cultures");
    return raw ? (JSON.parse(raw) as CulturePlot[]) : [];
  });

  const savePlots = (next: CulturePlot[]) => {
    setPlots(next);
    localStorage.setItem("wazo_cultures", JSON.stringify(next));
  };

  const addPlot = (e: React.FormEvent) => {
    e.preventDefault();
    const newPlot: CulturePlot = {
      id: `culture-${Date.now()}`,
      name: name.trim(),
      area: Number(area),
      cropType,
      sowingDate,
      stage,
    };
    savePlots([newPlot, ...plots]);
    setName("");
    setArea("");
    setCropType("riz");
    setSowingDate(new Date().toISOString().slice(0, 10));
    setStage("préparation");
    setShowForm(false);
  };

  const deletePlot = (id: string) => {
    savePlots(plots.filter((p) => p.id !== id));
  };

  const [dayTick, setDayTick] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.getTime();
  });

  useEffect(() => {
    const refresh = () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      setDayTick(today.getTime());
    };
    refresh();
    const interval = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const plotRows = useMemo(() => {
    const rows = plots.map((plot) => {
      const sowing = new Date(`${plot.sowingDate}T00:00:00`).getTime();
      const days = Math.max(0, Math.floor((dayTick - sowing) / (1000 * 60 * 60 * 24)));
      return { ...plot, days, progress: stageProgress(plot.stage) };
    });
    return rows.filter((plot) => {
      const cropOk = cropFilter === "all" || plot.cropType === cropFilter;
      const stageOk = stageFilter === "all" || plot.stage === stageFilter;
      return cropOk && stageOk;
    });
  }, [plots, cropFilter, stageFilter, dayTick]);

  const totalArea = useMemo(() => plots.reduce((acc, plot) => acc + Number(plot.area || 0), 0), [plots]);
  const harvestReadyCount = useMemo(() => plots.filter((plot) => plot.stage === "récolte").length, [plots]);
  const avgProgress = useMemo(() => {
    if (!plots.length) return 0;
    const sum = plots.reduce((acc, plot) => acc + stageProgress(plot.stage), 0);
    return Math.round(sum / plots.length);
  }, [plots]);

  return (
    <div className="min-h-screen bg-[#F5F5F0] pb-24">
      <header className="bg-[#075E54] px-4 py-4 text-white shadow-sm">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <h1 className="text-lg font-semibold">Suivi des cultures</h1>
          <Link href="/agriculture" className="text-sm text-white/90">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 p-4">
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-xl bg-white p-3 shadow-sm">
            <p className="text-lg font-semibold text-[#075E54]">{plots.length}</p>
            <p>Parcelles</p>
          </div>
          <div className="rounded-xl bg-white p-3 shadow-sm">
            <p className="text-lg font-semibold text-[#075E54]">{totalArea.toFixed(2)}</p>
            <p>Hectares</p>
          </div>
          <div className="rounded-xl bg-white p-3 shadow-sm">
            <p className="text-lg font-semibold text-[#075E54]">{harvestReadyCount}</p>
            <p>Récolte</p>
          </div>
        </div>
        <div className="rounded-xl bg-white p-3 text-xs text-gray-600 shadow-sm">
          Progression moyenne du cycle: <span className="font-semibold text-[#075E54]">{avgProgress}%</span>
        </div>
        <Button
          className="w-full bg-[#FF6F00] hover:opacity-90"
          onClick={() => setShowForm((v) => !v)}
        >
          <Plus className="h-4 w-4" />
          Ajouter une parcelle
        </Button>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <select
            value={cropFilter}
            onChange={(e) => setCropFilter(e.target.value as CultureType | "all")}
            className="flex h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm"
          >
            <option value="all">Toutes cultures</option>
            {cropTypes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value as CultureStage | "all")}
            className="flex h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm"
          >
            <option value="all">Tous stades</option>
            {stages.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {showForm && (
          <form onSubmit={addPlot} className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
            <div>
              <Label>Nom de la parcelle</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required className="mt-1" />
            </div>
            <div>
              <Label>Superficie (hectares)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label>Type de culture</Label>
              <select
                value={cropType}
                onChange={(e) => setCropType(e.target.value as CultureType)}
                className="mt-1 flex h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm"
              >
                {cropTypes.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Date de semis</Label>
              <Input
                type="date"
                value={sowingDate}
                onChange={(e) => setSowingDate(e.target.value)}
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label>Stade actuel</Label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value as CultureStage)}
                className="mt-1 flex h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm"
              >
                {stages.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" className="w-full bg-[#8B7355] hover:opacity-90">
              Enregistrer la parcelle
            </Button>
          </form>
        )}

        <section className="space-y-3">
          {plotRows.map((plot) => (
            <article key={plot.id} className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{plot.name}</p>
                  <p className="text-sm text-gray-600">
                    {plot.cropType} • {plot.area} ha
                  </p>
                </div>
                <button type="button" onClick={() => deletePlot(plot.id)} aria-label="Supprimer">
                  <Trash2 className="h-4 w-4 text-red-500" />
                </button>
              </div>
              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
                  <span>Stade: {plot.stage}</span>
                  <span>{Math.round(plot.progress)}%</span>
                </div>
                <div className="h-2 rounded-full bg-[#8B7355]/20">
                  <div
                    className="h-2 rounded-full bg-[#8B7355]"
                    style={{ width: `${plot.progress}%` }}
                  />
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-500">{plot.days} jour(s) depuis le semis</p>
            </article>
          ))}
          {plotRows.length === 0 && (
            <p className="rounded-xl bg-white p-4 text-sm text-gray-500 shadow-sm">
              Aucune parcelle enregistrée.
            </p>
          )}
        </section>
      </main>
    </div>
  );
}

