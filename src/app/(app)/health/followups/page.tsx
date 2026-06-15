"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Plus, Trash2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { localStore } from "@/lib/db";
import {
  addFollowUp,
  deleteFollowUp,
  listFollowUps,
  overdueFollowUps,
  toggleFollowUpDone,
  type PatientFollowUp,
} from "@/lib/health-followups";
import { buildWhatsAppShareUrl } from "@/lib/whatsapp-share";

export default function HealthFollowUpsPage() {
  const store = localStore.get();
  const [rows, setRows] = useState<PatientFollowUp[]>([]);
  const [name, setName] = useState("");
  const [due, setDue] = useState(() => new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [phone, setPhone] = useState("");

  const refresh = () => {
    if (store?.id) setRows(listFollowUps(store.id));
  };

  useEffect(() => {
    refresh();
  }, [store?.id]);

  const overdue = store?.id ? overdueFollowUps(store.id) : [];

  const remind = (f: PatientFollowUp) => {
    const text = `Bonjour ${f.patient_name}, rappel Wazo : ${f.reason}. Merci de nous recontacter.`;
    window.open(buildWhatsAppShareUrl(text, f.phone), "_blank", "noopener,noreferrer");
  };

  const submit = () => {
    if (!store?.id || !name.trim()) return;
    addFollowUp(store.id, {
      patient_name: name.trim(),
      due_date: due,
      reason: reason.trim() || "Contrôle de suivi",
      phone: phone.trim() || undefined,
    });
    setName("");
    setReason("");
    setPhone("");
    refresh();
  };

  if (!store) return <p className="p-4 text-sm">Boutique non configurée.</p>;

  return (
    <>
      <AppHeader title="Rappels de suivi" subtitle="Santé" />
      <main className="app-page space-y-4 pb-6">
        {overdue.length > 0 ? (
          <section className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">
            <Bell className="mb-1 inline h-4 w-4" /> {overdue.length} rappel(s) en retard
          </section>
        ) : null}

        <section className="app-card space-y-3 p-4">
          <h2 className="text-sm font-semibold">Planifier un suivi</h2>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du patient" />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Date prévue</Label>
              <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Téléphone (WhatsApp)</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+221…" className="mt-1" />
            </div>
          </div>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motif : contrôle, vaccin, renouvellement…" />
          <Button className="w-full" onClick={submit} disabled={!name.trim()}>
            <Plus className="mr-1 h-4 w-4" />
            Ajouter
          </Button>
        </section>

        <ul className="space-y-2">
          {rows.map((f) => (
            <li
              key={f.id}
              className={`app-card space-y-2 p-3 ${!f.done && f.due_date < new Date().toISOString().slice(0, 10) ? "border-rose-200" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{f.patient_name}</p>
                  <p className="text-xs text-gray-500">
                    {f.due_date} — {f.reason}
                  </p>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="text-red-600"
                  onClick={() => {
                    deleteFollowUp(store.id, f.id);
                    refresh();
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={f.done}
                    onChange={(e) => {
                      toggleFollowUpDone(store.id, f.id, e.target.checked);
                      refresh();
                    }}
                  />
                  Effectué
                </label>
                {f.phone ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => remind(f)}>
                    Rappel WhatsApp
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>

        <Link href="/health" className="block text-center text-xs text-gray-500">
          ← Santé
        </Link>
      </main>
    </>
  );
}
