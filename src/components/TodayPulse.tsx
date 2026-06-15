"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { buildTodayPulse, type TodayPulseItem } from "@/lib/engagement";
import type { ModuleId } from "@/types";

interface TodayPulseProps {
  storeId?: string;
  activeModules: ModuleId[];
  todaySalesCount: number;
  todaySalesTotal: number;
}

const toneClass: Record<TodayPulseItem["tone"], string> = {
  success: "border-green-200 bg-green-50 text-green-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  info: "border-sky-200 bg-sky-50 text-sky-900",
};

export function TodayPulse({
  storeId,
  activeModules,
  todaySalesCount,
  todaySalesTotal,
}: TodayPulseProps) {
  const [items, setItems] = useState<TodayPulseItem[]>([]);

  useEffect(() => {
    if (!storeId) return;
    void buildTodayPulse(storeId, activeModules, todaySalesCount, todaySalesTotal).then(
      setItems
    );
  }, [storeId, activeModules, todaySalesCount, todaySalesTotal]);

  if (!items.length) return null;

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-800">
        <Sparkles className="h-4 w-4 text-[#FF6F00]" />
        Votre journée
      </h2>
      <ul className="space-y-2">
        {items.map((item) => {
          const body = (
            <span className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${toneClass[item.tone]}`}>
              <span>{item.emoji}</span>
              {item.label}
            </span>
          );
          return (
            <li key={item.id}>
              {item.href ? (
                <Link href={item.href} className="block transition hover:opacity-90">
                  {body}
                </Link>
              ) : (
                body
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
