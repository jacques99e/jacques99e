"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import {
  MODULE_LOCAL_TOOLS,
  toolDescKey,
  toolTitleKey,
} from "@/lib/module-local-tools";
import { useI18n } from "@/contexts/I18nContext";
import type { ModuleId } from "@/types";

interface ModuleLocalToolsProps {
  moduleId: ModuleId;
}

export function ModuleLocalTools({ moduleId }: ModuleLocalToolsProps) {
  const { t } = useI18n();
  const tools = MODULE_LOCAL_TOOLS[moduleId];
  if (!tools.length) return null;

  return (
    <section className="rounded-2xl border border-[#075E54]/15 bg-[#075E54]/5 p-4">
      <h2 className="mb-1 text-sm font-semibold text-[#075E54]">{t("toolsSection.title")}</h2>
      <p className="mb-3 text-xs text-gray-600">{t("toolsSection.subtitle")}</p>
      <ul className="space-y-2">
        {tools.map((tool) => (
          <li key={tool.id}>
            <Link
              href={tool.href}
              className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 shadow-sm transition hover:bg-gray-50"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {t(toolTitleKey(moduleId, tool.id))}
                </p>
                <p className="text-xs text-gray-500">{t(toolDescKey(moduleId, tool.id))}</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-[#075E54]" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
