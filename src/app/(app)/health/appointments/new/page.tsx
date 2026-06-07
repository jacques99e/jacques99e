"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { logAuditEvent } from "@/lib/audit";
import { localStore } from "@/lib/db";
import { listPatients, saveAppointment } from "@/lib/health";
import { mapErrorToUserMessage } from "@/lib/user-messages";
import type { HealthPatient } from "@/types";

function toDatetimeLocalValue(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function NewHealthAppointmentForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const store = localStore.get();
  const [patients, setPatients] = useState<HealthPatient[]>([]);
  const [patientId, setPatientId] = useState("");
  const [scheduledAt, setScheduledAt] = useState(toDatetimeLocalValue(new Date()));
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"pending" | "confirmed" | "done">("pending");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!store) return;
    listPatients(store.id).then(setPatients);
  }, [store]);

  useEffect(() => {
    const preselect = searchParams.get("patient");
    if (preselect) setPatientId(preselect);
  }, [searchParams]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!store) {
      setError("Boutique introuvable.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const iso = new Date(scheduledAt).toISOString();
      const created = await saveAppointment(store.id, {
        patient_id: patientId || null,
        scheduled_at: iso,
        notes: notes.trim() || null,
        status,
      });
      await logAuditEvent({
        action: "health_appointment_created",
        entityType: "health_appointment",
        entityId: created?.id,
        payload: {
          status,
          scheduled_at: iso,
          patient_id: patientId || null,
        },
      });
      router.replace("/health/appointments");
    } catch (err) {
      setError(mapErrorToUserMessage(err, "Impossible de creer le rendez-vous pour le moment."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <AppHeader title="Nouveau rendez-vous" />
      <main className="mx-auto max-w-lg space-y-4 p-4">
        <Link href="/health/appointments" className="inline-flex items-center gap-2 text-sm text-wazo-green">
          <ArrowLeft className="h-4 w-4" />
          Retour aux rendez-vous
        </Link>

        <form onSubmit={onSubmit} className="space-y-4 rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800">
          <div className="space-y-1">
            <Label htmlFor="patient">Patient (optionnel)</Label>
            <select
              id="patient"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#075E54]"
            >
              <option value="">Sans patient spécifique</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="scheduledAt">Date et heure</Label>
            <Input
              id="scheduledAt"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="status">Statut</Label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as "pending" | "confirmed" | "done")}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#075E54]"
            >
              <option value="pending">En attente</option>
              <option value="confirmed">Confirmé</option>
              <option value="done">Effectué</option>
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#075E54]"
              placeholder="Motif, préparation, remarques..."
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <Button type="submit" disabled={submitting} className="w-full">
            <Save className="h-4 w-4" />
            {submitting ? "Enregistrement..." : "Créer le rendez-vous"}
          </Button>
        </form>
      </main>
    </>
  );
}

export default function NewHealthAppointmentPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-wazo-green border-t-transparent" />
        </div>
      }
    >
      <NewHealthAppointmentForm />
    </Suspense>
  );
}
