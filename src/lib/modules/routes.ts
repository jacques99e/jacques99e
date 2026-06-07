import type { ModuleId } from "@/types";

/** Préfixes de routes réservés à un module métier. */
export const MODULE_ROUTE_PREFIXES: Record<ModuleId, string[]> = {
  commerce: ["/products", "/sales", "/clients"],
  agriculture: ["/agriculture"],
  health: ["/health"],
  logistics: ["/logistics"],
  education: ["/education"],
  blockchain: ["/blockchain"],
};

const ALWAYS_OPEN_PREFIXES = [
  "/dashboard",
  "/messages",
  "/profile",
  "/settings",
  "/billing",
  "/modules",
  "/help",
  "/analytics",
  "/insights",
];

export function getModuleForPath(pathname: string): ModuleId | null {
  for (const [moduleId, prefixes] of Object.entries(MODULE_ROUTE_PREFIXES) as [
    ModuleId,
    string[],
  ][]) {
    if (prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
      return moduleId;
    }
  }
  return null;
}

export function isAlwaysOpenPath(pathname: string): boolean {
  return ALWAYS_OPEN_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function canAccessPath(pathname: string, activeModules: ModuleId[]): boolean {
  if (isAlwaysOpenPath(pathname)) return true;
  const required = getModuleForPath(pathname);
  if (!required) return true;
  return activeModules.includes(required);
}
