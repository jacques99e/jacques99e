"use client";

import Link from "next/link";
import { Crown } from "lucide-react";
import { premiumToolsForModule } from "@/lib/wazo-nexus";
import type { ModuleId } from "@/types";

export function ModulePremiumEdge({ moduleId }: { moduleId: ModuleId }) {
  const tools = premiumToolsForModule(moduleId);
  if (!tools.length) return null;

  return (
    <section className="rounded-2xl border border-indigo-200/80 bg-gradient-to-br from-indigo-950 to-[#1a1a2e] p-4 text-white shadow-md">
      <div className="mb-3 flex items-center gap-2">
        <Crown className="h-4 w-4 text-amber-400" />
        <h2 className="text-sm font-semibold text-amber-200">Wazo Premium</h2>
      </div>
      <ul className="space-y-2">
        {tools.map((tool) => (
          <li key={tool.id}>
            <Link
              href={tool.href}
              className="flex items-center gap-3 rounded-xl bg-white/10 px-3 py-2.5 transition hover:bg-white/15"
            >
              <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">
                {tool.badge}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{tool.title}</p>
                <p className="text-xs text-white/60">{tool.tagline}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
