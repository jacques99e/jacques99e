"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import {
  portalDescKey,
  portalFullUrl,
  portalLabelKey,
  portalsForModule,
} from "@/lib/module-portals";
import { useI18n } from "@/contexts/I18nContext";
import { localStore } from "@/lib/db";
import type { ModuleId } from "@/types";

interface ModulePublicPortalsProps {
  moduleId: ModuleId;
}

export function ModulePublicPortals({ moduleId }: ModulePublicPortalsProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState("");
  const store = localStore.get();
  const portals = portalsForModule(moduleId);
  if (!portals.length) return null;

  const copy = async (path: string, label: string) => {
    const url =
      path.includes("[slug]") && store?.slug
        ? portalFullUrl(path, store.slug)
        : portalFullUrl(path.replace("[slug]", store?.slug || ""));
    await navigator.clipboard.writeText(url);
    setCopied(label);
    setTimeout(() => setCopied(""), 2000);
  };

  return (
    <section className="rounded-2xl border border-[#FF6F00]/20 bg-[#FF6F00]/5 p-4">
      <h2 className="mb-2 text-sm font-semibold text-[#FF6F00]">{t("portals.title")}</h2>
      <ul className="space-y-2">
        {portals.map((portal) => {
          const label = t(portalLabelKey(portal.moduleId));
          const description = t(portalDescKey(portal.moduleId));
          const needsSlug = portal.path.includes("[slug]");
          if (needsSlug && !store?.slug) {
            return (
              <li key={portal.path} className="text-xs text-gray-500">
                {label} {t("portals.configureSlug")}
              </li>
            );
          }
          const href =
            needsSlug && store?.slug
              ? portalFullUrl(portal.path, store.slug)
              : portalFullUrl(portal.path);
          return (
            <li key={portal.path} className="flex items-center justify-between gap-2 rounded-lg bg-white p-2 text-xs">
              <div>
                <p className="font-medium text-gray-900">{label}</p>
                <p className="text-gray-500">{description}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  className="rounded border px-2 py-1 text-[10px] hover:bg-gray-50"
                  onClick={() => void copy(portal.path, label)}
                >
                  {copied === label ? t("portals.copied") : t("portals.copy")}
                </button>
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded border px-2 py-1 text-[10px] hover:bg-gray-50"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
