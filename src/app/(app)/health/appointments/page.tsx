"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/contexts/I18nContext";
import { localStore } from "@/lib/db";
import { downloadCsv, downloadSimplePdf } from "@/lib/export";
import { listAppointmentsWithPatients, updateAppointmentStatus } from "@/lib/health";
import { getWhatsAppLink } from "@/lib/utils";
import type { HealthAppointmentWithPatient } from "@/types";

export default function HealthAppointmentsPage() {
  const { t } = useI18n();
  const store = localStore.get();
  const [appointments, setAppointments] = useState<HealthAppointmentWithPatient[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!store) return;
    listAppointmentsWithPatients(store.id).then((data) => {
      const sorted = [...data].sort(
        (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
      );
      setAppointments(sorted);
    });
  }, [store]);

  const setStatus = async (id: string, status: "pending" | "confirmed" | "done") => {
    setUpdatingId(id);
    try {
      await updateAppointmentStatus(id, status);
      reload();
    } finally {
      setUpdatingId(null);
    }
  };

  useEffect(() => {
    reload();
  }, [reload]);

  const filteredAppointments = useMemo(() => {
    const q = search.trim().toLowerCase();
    return appointments.filter((item) => {
      const statusOk = statusFilter === "all" || item.status === statusFilter;
      const note = (item.notes ?? "").toLowerCase();
      const searchOk = !q || note.includes(q) || item.status.toLowerCase().includes(q);
      return statusOk && searchOk;
    });
  }, [appointments, search, statusFilter]);

  const prettyStatus = (status: string) => {
    if (status === "done") return "Effectué";
    if (status === "confirmed") return "Confirmé";
    return "En attente";
  };

  return (
    <>
      <AppHeader title={t("health.appointments")} />
      <main className="mx-auto max-w-lg space-y-4 p-4">
        <Link
          href="/health"
          className="inline-flex items-center gap-2 text-sm text-wazo-green"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("modules.health.title")}
        </Link>
        <Button asChild variant="outline" className="w-full">
          <Link href="/health/appointments/new">
            <Plus className="h-4 w-4" />
            Nouveau rendez-vous
          </Link>
        </Button>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher (statut, notes)"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm"
        >
          <option value="all">Tous les statuts</option>
          <option value="pending">En attente</option>
          <option value="confirmed">Confirmé</option>
          <option value="done">Effectué</option>
        </select>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button
            variant="outline"
            onClick={() =>
              downloadCsv(
                `rendez-vous-${new Date().toISOString().slice(0, 10)}.csv`,
                filteredAppointments.map((a) => ({
                  id: a.id,
                  scheduled_at: a.scheduled_at,
                  status: a.status,
                  notes: a.notes ?? "",
                }))
              )
            }
          >
            Export CSV
          </Button>
          <Button
            variant="outline"
            onClick={async () =>
              downloadSimplePdf(
                "Rendez-vous santé",
                filteredAppointments.map(
                  (a) =>
                    `${new Date(a.scheduled_at).toLocaleString("fr-FR")} | ${a.status} | ${a.notes ?? ""}`
                ),
                `rendez-vous-${new Date().toISOString().slice(0, 10)}.pdf`
              )
            }
          >
            Export PDF
          </Button>
        </div>

        {filteredAppointments.length === 0 ? (
          <p className="rounded-xl bg-white p-4 text-sm text-gray-500 shadow-sm dark:bg-gray-800">
            {t("common.noData")}
          </p>
        ) : (
          <ul className="space-y-2">
            {filteredAppointments.map((a) => (
              <li
                key={a.id}
                className="rounded-xl bg-white p-3 shadow-sm dark:bg-gray-800"
              >
                <p className="text-sm font-medium">
                  {new Date(a.scheduled_at).toLocaleString("fr-FR")}
                  {a.patient_name ? ` — ${a.patient_name}` : ""}
                </p>
                <p className="text-xs text-gray-500 capitalize">
                  Statut:{" "}
                  <span
                    className={
                      a.status === "done"
                        ? "text-green-700"
                        : a.status === "confirmed"
                          ? "text-blue-700"
                          : "text-amber-700"
                    }
                  >
                    {prettyStatus(a.status)}
                  </span>
                </p>
                {a.notes && <p className="mt-1 text-xs text-gray-600">{a.notes}</p>}
                <div className="mt-2 flex flex-wrap gap-2">
                  {a.status !== "confirmed" ? (
                    <button
                      type="button"
                      disabled={updatingId === a.id}
                      className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] text-blue-700"
                      onClick={() => void setStatus(a.id, "confirmed")}
                    >
                      Confirmer
                    </button>
                  ) : null}
                  {a.status !== "done" ? (
                    <button
                      type="button"
                      disabled={updatingId === a.id}
                      className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] text-green-700"
                      onClick={() => void setStatus(a.id, "done")}
                    >
                      Effectué
                    </button>
                  ) : null}
                </div>
                {a.patient_phone ? (
                  <div className="mt-2 flex gap-3">
                    <button
                      type="button"
                      className="text-xs text-rose-600 underline"
                      onClick={() =>
                        window.open(
                          getWhatsAppLink(
                            a.patient_phone!,
                            `Rappel RDV ${new Date(a.scheduled_at).toLocaleString("fr-FR")}`
                          ),
                          "_blank"
                        )
                      }
                    >
                      WhatsApp
                    </button>
                    <button
                      type="button"
                      className="text-xs text-rose-600 underline"
                      onClick={() =>
                        void fetch("/api/health/appointments/remind-sms", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ appointment_id: a.id }),
                        })
                      }
                    >
                      SMS
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
