import {
  Blocks,
  GraduationCap,
  HeartPulse,
  Leaf,
  Package,
  Truck,
  type LucideIcon,
} from "lucide-react";
import type { ModuleId } from "@/types";

export interface ModuleConfig {
  id: ModuleId;
  icon: LucideIcon;
  color: string;
  path: string;
  addPath?: string;
  widgets: string[];
}

export const MODULES: Record<ModuleId, ModuleConfig> = {
  commerce: {
    id: "commerce",
    icon: Package,
    color: "bg-wazo-green",
    path: "/products",
    addPath: "/sales",
    widgets: ["sales_today", "low_stock", "sales_chart"],
  },
  blockchain: {
    id: "blockchain",
    icon: Blocks,
    color: "bg-indigo-600",
    path: "/blockchain",
    addPath: "/blockchain/assets/new",
    widgets: ["blockchain_assets", "ledger_recent"],
  },
  agriculture: {
    id: "agriculture",
    icon: Leaf,
    color: "bg-emerald-600",
    path: "/agriculture",
    addPath: "/agriculture/parcels/new",
    widgets: ["farm_parcels", "weather_alert", "yield_estimate"],
  },
  health: {
    id: "health",
    icon: HeartPulse,
    color: "bg-rose-600",
    path: "/health",
    addPath: "/health/patients/new",
    widgets: ["patients_count", "appointments_today", "vitals_alert"],
  },
  logistics: {
    id: "logistics",
    icon: Truck,
    color: "bg-sky-600",
    path: "/logistics",
    addPath: "/logistics/deliveries/new",
    widgets: ["deliveries_active", "deliveries_pending"],
  },
  education: {
    id: "education",
    icon: GraduationCap,
    color: "bg-amber-600",
    path: "/education",
    addPath: "/education/courses/new",
    widgets: ["courses_count", "enrollments_recent"],
  },
};

export const ALL_MODULE_IDS = Object.keys(MODULES) as ModuleId[];

export const DEFAULT_MODULES: ModuleId[] = ["commerce"];

export function getModuleConfig(id: ModuleId): ModuleConfig {
  return MODULES[id];
}

export function getPrimaryModulePath(modules: ModuleId[]): string {
  const primary = modules[0] ?? "commerce";
  return MODULES[primary].path;
}
