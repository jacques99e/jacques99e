import type { ModuleId } from "@/types";

export interface ModuleLocalTool {
  id: string;
  href: string;
  /** wa.me, tel:, ou chemin interne */
  external?: boolean;
}

export function toolTitleKey(moduleId: ModuleId, toolId: string): string {
  return `tools.${moduleId}.${toolId}.title`;
}

export function toolDescKey(moduleId: ModuleId, toolId: string): string {
  return `tools.${moduleId}.${toolId}.desc`;
}

export const MODULE_LOCAL_TOOLS: Record<ModuleId, ModuleLocalTool[]> = {
  commerce: [
    { id: "momo", href: "/sales" },
    { id: "whatsapp", href: "/products" },
    { id: "crm", href: "/clients" },
    { id: "vitrine", href: "/profile" },
    { id: "credit", href: "/sales/credit" },
  ],
  agriculture: [
    { id: "meteo", href: "/agriculture/cultures" },
    { id: "intrants", href: "/agriculture/intrants" },
    { id: "marches", href: "/agriculture/marches" },
    { id: "rendement", href: "/agriculture/rendement" },
    { id: "vente", href: "/products/add?category=Agriculture" },
    { id: "calendrier", href: "/agriculture/calendrier" },
  ],
  health: [
    { id: "patient", href: "/health/patients/new" },
    { id: "rdv", href: "/health/appointments/new" },
    { id: "ordonnance", href: "/health" },
    { id: "teleconsult", href: "/clients" },
    { id: "pharmacie", href: "/health/pharmacie" },
  ],
  logistics: [
    { id: "new", href: "/logistics/deliveries/new" },
    { id: "track", href: "/suivi" },
    { id: "pod", href: "/logistics" },
    { id: "cod", href: "/sales" },
    { id: "tournee", href: "/logistics/tournee" },
  ],
  education: [
    { id: "video", href: "/education" },
    { id: "cert", href: "/education" },
    { id: "portal", href: "/formation" },
    { id: "invite", href: "/education/courses/new" },
    { id: "offline", href: "/education" },
    { id: "presence", href: "/education/presence" },
  ],
  blockchain: [
    { id: "asset", href: "/blockchain/assets/new" },
    { id: "coop", href: "/blockchain/contracts" },
    { id: "verify", href: "/trace" },
    { id: "ledger", href: "/blockchain" },
    { id: "export", href: "/blockchain" },
    { id: "qr", href: "/blockchain/qr" },
  ],
};

export function buildWhatsAppShareUrl(text: string, phone?: string): string {
  const base = phone
    ? `https://wa.me/${phone.replace(/\D/g, "")}`
    : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(text)}`;
}
