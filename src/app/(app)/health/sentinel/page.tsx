"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, AlertTriangle, MessageCircle, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { localStore } from "@/lib/db";
import {
  addVaccination,
  buildVaccineCampaignMessage,
  getCommunitySignals,
  readVaccinations,
  reportCommunitySymptom,
  toggleVaccinationDone,
  vaccinePresets,
} from "@/lib/health-sentinel";
import { buildWhatsAppShareUrl } from "@/lib/module-local-tools";

export default function SentinelPage() {
  const storeId = localStore.get()?.id;
  const [vax, setVax] = useState(() => readVaccinations(storeId));
  const [signals, setSignals] = useState(() => getCommunitySignals());
  const [patient, setPatient] = useState("");
  const [vaccine, setVaccine] = useState(vaccinePresets()[0]);
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [neighborhood, setNeighborhood] = useState("");

  const submitVax = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patient.trim()) return;
    setVax(addVaccination({ patientLabel: patient.trim(), vaccine, dueDate, done: false }, storeId));
    setPatient("");
  };

  const report = (symptom: string) => {
    setSignals(reportCommunitySymptom(symptom));
  };

  const highAlert = signals.some((s) => s.level === "high");

  return (
    <div className="min-h-screen bg-[#F5F5F0] pb-24">
      <header className="bg-rose-800 px-4 py-4 text-white">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <Shield className="h-5 w-5" /> Santé Sentinel
          </h1>
          <Link href="/health"><ArrowLeft className="h-4 w-4" /></Link>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 p-4">
        <p className="rounded-2xl bg-rose-50 p-4 text-xs text-rose-900">
          Veille communautaire : calendrier vaccinal + signaux symptômes agrégés pour anticiper les flambées.
        </p>

        {highAlert ? (
          <div className="flex items-center gap-2 rounded-xl bg-red-100 p-3 text-xs text-red-800">
            <AlertTriangle className="h-4 w-4" />
            Signal épidémique élevé détecté — renforcez la surveillance.
          </div>
        ) : null}

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold">Signaux communautaires (semaine)</h2>
          <ul className="space-y-2">
            {signals.map((s) => (
              <li key={s.id} className="flex justify-between rounded-lg bg-gray-50 p-2 text-xs">
                <span>{s.symptom}</span>
                <span
                  className={
                    s.level === "high"
                      ? "font-bold text-red-600"
                      : s.level === "medium"
                        ? "text-amber-600"
                        : "text-gray-500"
                  }
                >
                  {s.count} cas
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex flex-wrap gap-2">
            {["Fièvre", "Toux", "Diarrhée", "Vomissements"].map((sym) => (
              <Button key={sym} type="button" size="sm" variant="outline" onClick={() => report(sym)}>
                + {sym}
              </Button>
            ))}
          </div>
        </section>

        <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold">Campagne vaccinale (quartier)</h2>
          <div>
            <Label>Quartier / village</Label>
            <Input
              value={neighborhood}
              onChange={(e) => setNeighborhood(e.target.value)}
              placeholder="Adidogomé, Nyékonakpoé…"
            />
          </div>
          <Button
            type="button"
            className="w-full"
            disabled={!neighborhood.trim()}
            onClick={() => {
              const msg = buildVaccineCampaignMessage({
                neighborhood: neighborhood.trim(),
                vaccine,
                dueDate,
                organizer: localStore.get()?.name,
              });
              window.open(buildWhatsAppShareUrl(msg), "_blank", "noopener,noreferrer");
            }}
          >
            <MessageCircle className="mr-1 h-4 w-4" /> Diffuser sur WhatsApp
          </Button>
        </section>

        <form onSubmit={submitVax} className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold">Calendrier vaccinal</h2>
          <div>
            <Label>Patient / enfant</Label>
            <Input value={patient} onChange={(e) => setPatient(e.target.value)} required />
          </div>
          <div>
            <Label>Vaccin</Label>
            <select
              className="w-full rounded-lg border px-3 py-2 text-sm"
              value={vaccine}
              onChange={(e) => setVaccine(e.target.value)}
            >
              {vaccinePresets().map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Date prévue</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <Button type="submit" className="w-full">Planifier</Button>
        </form>

        {vax.length > 0 ? (
          <ul className="space-y-2">
            {vax.slice(0, 10).map((v) => (
              <li key={v.id} className="flex items-center justify-between rounded-xl bg-white p-3 text-xs shadow-sm">
                <div>
                  <p className="font-medium">{v.patientLabel}</p>
                  <p className="text-gray-500">{v.vaccine} — {v.dueDate}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={v.done ? "default" : "outline"}
                  onClick={() => setVax(toggleVaccinationDone(v.id, storeId))}
                >
                  {v.done ? "Fait" : "À faire"}
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </main>
    </div>
  );
}
