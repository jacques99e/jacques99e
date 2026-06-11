"use client";

import Link from "next/link";
import { Crown, Zap } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { useModule } from "@/hooks/useModule";
import { localStore } from "@/lib/db";
import { premiumToolsForModules } from "@/lib/wazo-nexus";
import { computeWazoScore } from "@/lib/wazo-score";
import { MODULE_LABELS } from "@/lib/modules/config";

export default function NexusPage() {
  const store = localStore.get();
  const { modules } = useModule(store?.id);
  const score = computeWazoScore(modules);
  const tools = premiumToolsForModules(modules).filter((t) => t.id !== "nexus");

  return (
    <>
      <AppHeader title="Wazo Nexus" subtitle="Centre de commande" />
      <main className="app-page space-y-4 pb-8">
        <section className="rounded-3xl bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] p-6 text-white shadow-xl">
          <div className="flex items-center gap-2">
            <Crown className="h-6 w-6 text-amber-400" />
            <h2 className="text-lg font-bold">Score continental</h2>
          </div>
          <div className="mt-4 flex items-end gap-4">
            <p className="text-6xl font-black tabular-nums">{score.overall}</p>
            <div>
              <p className="text-2xl font-bold text-amber-400">{score.grade}</p>
              <p className="text-xs text-white/60">/ 100</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Object.entries(score.modules).map(([id, val]) => (
              <div key={id} className="rounded-xl bg-white/10 px-3 py-2 text-center">
                <p className="text-lg font-bold">{val}</p>
                <p className="text-[10px] text-white/70">{MODULE_LABELS[id as keyof typeof MODULE_LABELS]}</p>
              </div>
            ))}
          </div>
        </section>

        {score.signals.length > 0 ? (
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-800">
              <Zap className="h-4 w-4 text-amber-500" /> Signaux prioritaires
            </h3>
            <ul className="space-y-1 text-xs text-gray-600">
              {score.signals.map((s) => (
                <li key={s}>• {s}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {score.actions.length > 0 ? (
          <section className="flex flex-wrap gap-2">
            {score.actions.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="rounded-full bg-[#075E54] px-4 py-2 text-xs font-semibold text-white"
              >
                {a.label}
              </Link>
            ))}
          </section>
        ) : null}

        <section>
          <h3 className="mb-3 text-sm font-semibold text-gray-800">Arsenal premium Wazo</h3>
          <div className="grid gap-3">
            {tools.map((tool) => (
              <Link
                key={tool.id}
                href={tool.href}
                className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-white p-4 shadow-sm transition hover:border-indigo-300"
              >
                <div className="flex items-center gap-2">
                  <span className="rounded bg-indigo-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                    {tool.badge}
                  </span>
                  <p className="font-semibold text-gray-900">{tool.title}</p>
                </div>
                <p className="mt-1 text-xs text-indigo-600">{tool.tagline}</p>
                <p className="mt-1 text-xs text-gray-500">{tool.description}</p>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
