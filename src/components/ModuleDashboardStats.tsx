"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Blocks,
  GraduationCap,
  HeartPulse,
  Leaf,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { MODULES } from "@/lib/modules/config";
import { useI18n } from "@/contexts/I18nContext";
import { useModuleLabelFn } from "@/hooks/useModuleLabel";
import { listParcels } from "@/lib/agriculture";
import { listAssets } from "@/lib/blockchain";
import { listCourses } from "@/lib/education";
import { listPatients, listAppointments } from "@/lib/health";
import { listDeliveries } from "@/lib/logistics";
import type { ModuleId } from "@/types";

interface ModuleDashboardStatsProps {
  storeId: string;
  modules: ModuleId[];
}

interface StatRow {
  moduleId: ModuleId;
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
  href: string;
  accent?: "green" | "orange" | "red" | "sky";
}

export function ModuleDashboardStats({ storeId, modules }: ModuleDashboardStatsProps) {
  const { t } = useI18n();
  const moduleLabel = useModuleLabelFn();
  const [rows, setRows] = useState<StatRow[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const next: StatRow[] = [];

      if (modules.includes("health")) {
        const [patients, appointments] = await Promise.all([
          listPatients(storeId),
          listAppointments(storeId),
        ]);
        const today = new Date().toISOString().slice(0, 10);
        const todayCount = appointments.filter((a) => a.scheduled_at?.slice(0, 10) === today).length;
        next.push({
          moduleId: "health",
          icon: HeartPulse,
          label: "Patients",
          value: String(patients.length),
          hint: `${todayCount} RDV aujourd'hui`,
          href: MODULES.health.path,
          accent: "red",
        });
      }

      if (modules.includes("logistics")) {
        const deliveries = await listDeliveries(storeId);
        const active = deliveries.filter(
          (d) => d.status !== "delivered" && d.status !== "cancelled"
        ).length;
        next.push({
          moduleId: "logistics",
          icon: Truck,
          label: "Livraisons",
          value: String(deliveries.length),
          hint: `${active} en cours`,
          href: MODULES.logistics.path,
          accent: "sky",
        });
      }

      if (modules.includes("education")) {
        const courses = await listCourses(storeId);
        next.push({
          moduleId: "education",
          icon: GraduationCap,
          label: "Cours",
          value: String(courses.length),
          hint: `${courses.filter((c) => c.is_public).length} public(s)`,
          href: MODULES.education.path,
          accent: "orange",
        });
      }

      if (modules.includes("blockchain")) {
        const assets = await listAssets(storeId);
        next.push({
          moduleId: "blockchain",
          icon: Blocks,
          label: "Actifs",
          value: String(assets.length),
          hint: "Traçabilité enregistrée",
          href: MODULES.blockchain.path,
          accent: "sky",
        });
      }

      if (modules.includes("agriculture")) {
        const parcels = await listParcels(storeId);
        next.push({
          moduleId: "agriculture",
          icon: Leaf,
          label: "Parcelles",
          value: String(parcels.length),
          hint: "Cultures, intrants & marchés",
          href: MODULES.agriculture.path,
          accent: "green",
        });
      }

      if (!cancelled) setRows(next);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [storeId, modules, t, moduleLabel]);

  if (rows.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-bold text-gray-800">{t("dashboard.yourStats")}</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {rows.map((row) => (
          <Link key={row.moduleId} href={row.href}>
            <StatCard
              icon={row.icon}
              label={moduleLabel(row.moduleId)}
              value={row.value}
              hint={row.hint}
              accent={row.accent}
              className="transition hover:border-wazo-green/20 hover:shadow-wazo"
            />
          </Link>
        ))}
      </div>
    </section>
  );
}
