"use client";

import Link from "next/link";
import { Crown, ChevronRight } from "lucide-react";
import { computeWazoScore } from "@/lib/wazo-score";
import type { ModuleId } from "@/types";

export function WazoNexusCard({ activeModules }: { activeModules: ModuleId[] }) {
  const score = computeWazoScore(activeModules);

  return (
    <Link
      href="/nexus"
      className="block rounded-3xl bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] p-5 text-white shadow-lg transition hover:shadow-xl"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-amber-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-300/90">
              Wazo Nexus
            </span>
          </div>
          <p className="mt-2 text-sm text-white/80">Score santé business continental</p>
        </div>
        <div className="text-center">
          <p className="text-4xl font-black tabular-nums">{score.overall}</p>
          <p className="text-xs font-bold text-amber-400">{score.grade}</p>
        </div>
      </div>
      {score.signals[0] ? (
        <p className="mt-3 line-clamp-2 text-xs text-white/70">{score.signals[0]}</p>
      ) : null}
      <p className="mt-3 flex items-center gap-1 text-xs font-semibold text-amber-300">
        Centre de commande premium
        <ChevronRight className="h-4 w-4" />
      </p>
    </Link>
  );
}
