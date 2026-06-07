"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { MODULE_PUBLIC_PORTALS, portalFullUrl } from "@/lib/module-portals";
import { MODULE_LABELS } from "@/lib/modules/config";
import { localStore } from "@/lib/db";

export function AllModulePortals() {
  const store = localStore.get();

  return (
    <section className="rounded-2xl border border-[#075E54]/15 bg-white p-4 shadow-sm dark:bg-gray-800">
      <h2 className="mb-2 text-sm font-semibold text-[#075E54]">Portails publics (tous modules)</h2>
      <ul className="space-y-2 text-xs">
        {MODULE_PUBLIC_PORTALS.map((portal) => {
          const needsSlug = portal.path.includes("[slug]");
          if (needsSlug && !store?.slug) return null;
          const href = needsSlug
            ? portalFullUrl(portal.path, store!.slug)
            : portalFullUrl(portal.path);
          return (
            <li key={portal.path} className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 p-2">
              <div>
                <p className="font-medium">{MODULE_LABELS[portal.moduleId]}</p>
                <p className="text-gray-500">{portal.label}</p>
              </div>
              <Link href={href} target="_blank" className="flex items-center gap-1 text-[#075E54] underline">
                Ouvrir <ExternalLink className="h-3 w-3" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
