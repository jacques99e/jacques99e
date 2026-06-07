import type { ModuleId } from "@/types";

export interface ModulePortalLink {
  moduleId: ModuleId;
  label: string;
  path: string;
  description: string;
}

function appBaseUrl(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return (process.env.NEXT_PUBLIC_APP_URL || "https://wazo-digital.vercel.app").replace(/\/$/, "");
}

export function portalFullUrl(path: string, slug?: string): string {
  const base = appBaseUrl();
  return slug ? `${base}${path.replace("[slug]", slug)}` : `${base}${path}`;
}

export const MODULE_PUBLIC_PORTALS: ModulePortalLink[] = [
  {
    moduleId: "commerce",
    label: "Boutique en ligne",
    path: "/boutique/[slug]",
    description: "Vitrine publique — commandes WhatsApp",
  },
  {
    moduleId: "education",
    label: "Portail formation",
    path: "/formation",
    description: "Accès cours par code invitation",
  },
  {
    moduleId: "logistics",
    label: "Suivi colis",
    path: "/suivi",
    description: "Client suit sa livraison",
  },
  {
    moduleId: "blockchain",
    label: "Traçabilité",
    path: "/trace",
    description: "Vérifier un actif par hash",
  },
];

export function portalsForModule(moduleId: ModuleId): ModulePortalLink[] {
  return MODULE_PUBLIC_PORTALS.filter((p) => p.moduleId === moduleId);
}
