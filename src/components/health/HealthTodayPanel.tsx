"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Calendar, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listAppointmentsWithPatients } from "@/lib/health";
import { getWhatsAppLink } from "@/lib/utils";
import type { HealthAppointmentWithPatient } from "@/types";

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

export function HealthTodayPanel({ storeId }: { storeId: string }) {
  const [rows, setRows] = useState<HealthAppointmentWithPatient[]>([]);
  useEffect(() => { void listAppointmentsWithPatients(storeId).then(setRows); }, [storeId]);
  const today = useMemo(() => rows.filter((r) => isToday(r.scheduled_at)), [rows]);

  return (
    <section className="rounded-2xl border border-rose-200 bg-white p-4 shadow-sm">
      <div className="flex justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-rose-700">
          <Calendar className="h-4 w-4" /> Aujourd&apos;hui ({today.length})
        </h2>
        <Link href="/health/appointments" className="text-xs text-rose-600 underline">Tous</Link>
      </div>
      {today.length === 0 ? (
        <p className="mt-2 text-xs text-gray-500">Aucun RDV aujourd&apos;hui.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {today.map((a) => (
            <li key={a.id} className="rounded-lg bg-rose-50 p-3 text-xs">
              <p className="font-medium">{new Date(a.scheduled_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} — {a.patient_name || "Patient"}</p>
              {a.patient_phone ? (
                <div className="mt-2 flex gap-2">
                  <Button type="button" size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => window.open(getWhatsAppLink(a.patient_phone!, `Rappel RDV ${new Date(a.scheduled_at).toLocaleString("fr-FR")}`), "_blank")}>
                    <MessageCircle className="mr-1 h-3 w-3" /> WhatsApp
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-[10px]"
                    onClick={async () => {
                      await fetch("/api/health/appointments/remind-sms", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ appointment_id: a.id }),
                      });
                    }}
                  >
                    SMS
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
