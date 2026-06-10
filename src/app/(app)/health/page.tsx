"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Calendar, Pill } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/contexts/I18nContext";
import { localStore } from "@/lib/db";
import { HealthTodayPanel } from "@/components/health/HealthTodayPanel";
import { ModuleStatGrid } from "@/components/ModuleStatGrid";
import { ModuleCompetitiveEdge } from "@/components/ModuleCompetitiveEdge";
import { ModuleMenuLink } from "@/components/ModuleMenuLink";
import { ModulePublicPortals } from "@/components/ModulePublicPortals";
import { listPatients, listAppointments } from "@/lib/health";
import type { HealthPatient } from "@/types";

export default function HealthPage() {
  const { t } = useI18n();
  const store = localStore.get();
  const [patients, setPatients] = useState<HealthPatient[]>([]);
  const [apptCount, setApptCount] = useState(0);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!store) return;
    listPatients(store.id).then(setPatients);
    listAppointments(store.id).then((a) => setApptCount(a.length));
  }, [store]);

  const filteredPatients = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter(
      (patient) =>
        patient.full_name.toLowerCase().includes(q) ||
        (patient.blood_group ?? "").toLowerCase().includes(q)
    );
  }, [patients, search]);

  return (
    <>
      <AppHeader title={t("modules.health.title")} />
      <main className="app-page space-y-4 pb-6">
        <ModuleStatGrid
          items={[
            { value: patients.length, label: t("health.patients"), accent: "text-rose-600" },
            { value: apptCount, label: "Rendez-vous", accent: "text-rose-600" },
          ]}
        />
        <ModulePublicPortals moduleId="health" />
        <ModuleCompetitiveEdge moduleId="health" />

        {store ? <HealthTodayPanel storeId={store.id} /> : null}

        <ModuleMenuLink
          href="/health/pharmacie"
          icon={Pill}
          title="Mini pharmacie"
          description="Stock médicaments, alertes rupture et expiration"
          iconClassName="bg-rose-700/10 text-rose-800"
        />

        <Button asChild className="w-full">
          <Link href="/health/patients/new">
            <Plus className="h-4 w-4" />
            {t("health.newPatient")}
          </Link>
        </Button>
        <Button asChild variant="outline" className="w-full">
          <Link href="/health/appointments/new">
            <Calendar className="h-4 w-4" />
            Nouveau rendez-vous
          </Link>
        </Button>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un patient"
        />

        <ul className="space-y-2">
          {filteredPatients.map((p) => (
            <li key={p.id}>
              <Link
                href={`/health/patients/${encodeURIComponent(p.id)}`}
                className="app-list-item justify-between"
              >
                <span className="font-medium">{p.full_name}</span>
                <span className="text-xs text-gray-500">{p.blood_group || "—"}</span>
              </Link>
            </li>
          ))}
        </ul>
        {filteredPatients.length === 0 ? (
          <p className="app-card p-3 text-xs text-gray-500">
            Aucun patient trouvé.
          </p>
        ) : null}

        <Link href="/health/appointments" className="flex items-center gap-2 text-sm text-wazo-green">
          <Calendar className="h-4 w-4" />
          {t("health.appointments")}
        </Link>
      </main>
    </>
  );
}
