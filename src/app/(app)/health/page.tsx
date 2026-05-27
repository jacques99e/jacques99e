"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Calendar } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/contexts/I18nContext";
import { localStore } from "@/lib/db";
import { listPatients, listAppointments } from "@/lib/health";
import type { HealthPatient } from "@/types";

export default function HealthPage() {
  const { t } = useI18n();
  const store = localStore.get();
  const [patients, setPatients] = useState<HealthPatient[]>([]);
  const [apptCount, setApptCount] = useState(0);

  useEffect(() => {
    if (!store) return;
    listPatients(store.id).then(setPatients);
    listAppointments(store.id).then((a) => setApptCount(a.length));
  }, [store]);

  return (
    <>
      <AppHeader title={t("modules.health.title")} />
      <main className="mx-auto max-w-lg space-y-4 p-4">
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-gray-800">
            <p className="text-2xl font-bold text-rose-600">{patients.length}</p>
            <p className="text-xs">{t("health.patients")}</p>
          </div>
          <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-gray-800">
            <p className="text-2xl font-bold text-rose-600">{apptCount}</p>
            <p className="text-xs">{t("health.appointments")}</p>
          </div>
        </div>

        <Button asChild className="w-full">
          <Link href="/health/patients/new">
            <Plus className="h-4 w-4" />
            {t("health.newPatient")}
          </Link>
        </Button>

        <ul className="space-y-2">
          {patients.map((p) => (
            <li key={p.id}>
              <Link
                href={`/health/patients/${encodeURIComponent(p.id)}`}
                className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm dark:bg-gray-800"
              >
                <span className="font-medium">{p.full_name}</span>
                <span className="text-xs text-gray-500">{p.blood_group || "—"}</span>
              </Link>
            </li>
          ))}
        </ul>

        <Link href="/health/appointments" className="flex items-center gap-2 text-sm text-wazo-green">
          <Calendar className="h-4 w-4" />
          {t("health.appointments")}
        </Link>
      </main>
    </>
  );
}
