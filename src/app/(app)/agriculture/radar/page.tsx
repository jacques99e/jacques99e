"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Radar, TrendingDown, TrendingUp } from "lucide-react";
import { computePriceSignals, getDiseaseAlerts, getSowingWindow } from "@/lib/agri-radar";
import { formatCurrency } from "@/lib/utils";

const CROPS = ["all", "Cacao", "Maïs", "Riz", "Anacarde"];

export default function AgriRadarPage() {
  const [crop, setCrop] = useState("all");
  const alerts = useMemo(() => getDiseaseAlerts(crop === "all" ? undefined : crop), [crop]);
  const signals = useMemo(() => computePriceSignals(), []);

  return (
    <div className="min-h-screen bg-[#F5F5F0] pb-24">
      <header className="bg-emerald-900 px-4 py-4 text-white">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <Radar className="h-5 w-5" /> Agri Radar
          </h1>
          <Link href="/agriculture"><ArrowLeft className="h-4 w-4" /></Link>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 p-4">
        <p className="rounded-2xl bg-emerald-50 p-4 text-xs text-emerald-900">
          Veille continentale : maladies, signaux prix et fenêtres de semis — avant vos concurrents.
        </p>

        <select
          className="w-full rounded-xl border px-3 py-2 text-sm"
          value={crop}
          onChange={(e) => setCrop(e.target.value)}
        >
          {CROPS.map((c) => (
            <option key={c} value={c}>{c === "all" ? "Toutes cultures" : c}</option>
          ))}
        </select>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-red-800">Alertes sanitaires</h2>
          <ul className="space-y-2">
            {alerts.map((a) => (
              <li
                key={a.id}
                className={`rounded-xl p-3 text-xs ${
                  a.level === "critical"
                    ? "bg-red-50 text-red-900"
                    : a.level === "watch"
                      ? "bg-amber-50 text-amber-900"
                      : "bg-blue-50 text-blue-900"
                }`}
              >
                <p className="font-semibold">{a.crop} — {a.title}</p>
                <p className="mt-1">{a.message}</p>
                <p className="mt-1 font-medium">→ {a.action}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold">Signaux prix marché</h2>
          <ul className="space-y-2">
            {signals.map((s) => (
              <li key={s.crop} className="flex items-center justify-between rounded-lg border p-2 text-sm">
                <span>{s.crop}</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{formatCurrency(s.current)}/kg</span>
                  {s.trend === "up" ? (
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  ) : s.trend === "down" ? (
                    <TrendingDown className="h-4 w-4 text-red-600" />
                  ) : null}
                  <span className="text-xs text-gray-500">{s.changePercent > 0 ? "+" : ""}{s.changePercent}%</span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {crop !== "all" ? (
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900">
            <p className="font-semibold">Fenêtre {crop}</p>
            <p className="mt-1">{getSowingWindow(crop)}</p>
            <Link href="/agriculture/calendrier" className="mt-2 inline-block underline">
              Planifier dans le calendrier
            </Link>
          </section>
        ) : null}
      </main>
    </div>
  );
}
