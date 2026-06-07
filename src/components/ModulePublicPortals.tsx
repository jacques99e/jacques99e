"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { portalFullUrl, portalsForModule } from "@/lib/module-portals";
import { localStore } from "@/lib/db";
import type { ModuleId } from "@/types";

interface ModulePublicPortalsProps {
  moduleId: ModuleId;
}

export function ModulePublicPortals({ moduleId }: ModulePublicPortalsProps) {
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
      <h2 className="mb-2 text-sm font-semibold text-[#FF6F00]">Liens publics clients</h2>
      <ul className="space-y-2">
        {portals.map((portal) => {
          const needsSlug = portal.path.includes("[slug]");
          if (needsSlug && !store?.slug) {
            return (
              <li key={portal.path} className="text-xs text-gray-500">
                {portal.label} — configurez le slug boutique dans le profil
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
                <p className="font-medium text-gray-900">{portal.label}</p>
                <p className="text-gray-500">{portal.description}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  className="rounded border px-2 py-1 text-[10px] hover:bg-gray-50"
                  onClick={() => void copy(portal.path, portal.label)}
                >
                  {copied === portal.label ? "✓" : "Copier"}
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
