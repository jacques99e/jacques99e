import type { ModuleId } from "@/types";

export interface ModulePortalLink {
  moduleId: ModuleId;
  path: string;
}

function appBaseUrl(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return (process.env.NEXT_PUBLIC_APP_URL || "https://wazo-digital.vercel.app").replace(/\/$/, "");
}

export function portalFullUrl(path: string, slug?: string): string {
  const base = appBaseUrl();
  return slug ? `${base}${path.replace("[slug]", slug)}` : `${base}${path}`;
}

export function portalLabelKey(moduleId: ModuleId): string {
  return `portal.${moduleId}.label`;
}

export function portalDescKey(moduleId: ModuleId): string {
  return `portal.${moduleId}.desc`;
}

export const MODULE_PUBLIC_PORTALS: ModulePortalLink[] = [
  { moduleId: "commerce", path: "/boutique/[slug]" },
  { moduleId: "education", path: "/formation" },
  { moduleId: "logistics", path: "/suivi" },
  { moduleId: "blockchain", path: "/trace" },
];

export function portalsForModule(moduleId: ModuleId): ModulePortalLink[] {
  return MODULE_PUBLIC_PORTALS.filter((p) => p.moduleId === moduleId);
}
