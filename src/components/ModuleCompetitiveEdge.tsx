"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import {
  advantageDescKey,
  advantageTitleKey,
  advantagesForModule,
} from "@/lib/module-advantages";
import { useI18n } from "@/contexts/I18nContext";
import type { ModuleId } from "@/types";

interface ModuleCompetitiveEdgeProps {
  moduleId: ModuleId;
  maxItems?: number;
}

export function ModuleCompetitiveEdge({ moduleId, maxItems = 4 }: ModuleCompetitiveEdgeProps) {
  const { t } = useI18n();
  const items = advantagesForModule(moduleId).slice(0, maxItems);
  if (!items.length) return null;

  return (
    <section className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50 to-white p-4 shadow-sm dark:border-amber-900/40 dark:from-amber-950/30 dark:to-gray-900">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-amber-600" />
        <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
          {t("competitive.title")}
        </h2>
      </div>
      <ul className="space-y-2">
        {items.map((item) => {
          const content = (
            <>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {t(advantageTitleKey(moduleId, item.id))}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {t(advantageDescKey(moduleId, item.id))}
              </p>
            </>
          );
          if (item.href) {
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="block rounded-xl bg-white/80 px-3 py-2 transition hover:bg-white dark:bg-gray-800/80 dark:hover:bg-gray-800"
                >
                  {content}
                </Link>
              </li>
            );
          }
          return (
            <li
              key={item.id}
              className="rounded-xl bg-white/80 px-3 py-2 dark:bg-gray-800/80"
            >
              {content}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
