"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookMarked, Plus, Trash2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { localStore } from "@/lib/db";
import {
  addFieldJournalEntry,
  deleteFieldJournalEntry,
  listFieldJournal,
  type FieldJournalEntry,
} from "@/lib/agriculture-journal";

const ACTIVITIES = ["Semis", "Traitement", "Irrigation", "Récolte", "Visite", "Autre"];

export default function AgricultureJournalPage() {
  const store = localStore.get();
  const [entries, setEntries] = useState<FieldJournalEntry[]>([]);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [parcel, setParcel] = useState("");
  const [activity, setActivity] = useState(ACTIVITIES[0]);
  const [notes, setNotes] = useState("");

  const refresh = () => {
    if (store?.id) setEntries(listFieldJournal(store.id));
  };

  useEffect(() => {
    refresh();
  }, [store?.id]);

  const submit = () => {
    if (!store?.id || !parcel.trim()) return;
    addFieldJournalEntry(store.id, {
      date,
      parcel_label: parcel.trim(),
      activity,
      notes: notes.trim(),
    });
    setNotes("");
    refresh();
  };

  if (!store) return <p className="p-4 text-sm">Boutique non configurée.</p>;

  return (
    <>
      <AppHeader title="Journal de champ" subtitle="Agriculture" />
      <main className="app-page space-y-4 pb-6">
        <p className="text-xs text-gray-600">
          Notez chaque intervention par parcelle — semis, traitement, récolte. Exportable et
          consultable hors ligne.
        </p>

        <section className="app-card space-y-3 p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <BookMarked className="h-4 w-4 text-emerald-700" />
            Nouvelle entrée
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Parcelle / culture</Label>
              <Input value={parcel} onChange={(e) => setParcel(e.target.value)} placeholder="Champ Nord" className="mt-1" />
            </div>
          </div>
          <div>
            <Label>Activité</Label>
            <select
              value={activity}
              onChange={(e) => setActivity(e.target.value)}
              className="mt-1 flex h-10 w-full rounded-lg border px-2 text-sm"
            >
              {ACTIVITIES.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Détails, produit utilisé…" className="mt-1" />
          </div>
          <Button className="w-full" onClick={submit} disabled={!parcel.trim()}>
            <Plus className="mr-1 h-4 w-4" />
            Enregistrer
          </Button>
        </section>

        <ul className="space-y-2">
          {entries.map((e) => (
            <li key={e.id} className="app-card flex items-start justify-between gap-2 p-3">
              <div>
                <p className="text-xs text-gray-400">{e.date}</p>
                <p className="font-medium">
                  {e.parcel_label} — {e.activity}
                </p>
                {e.notes ? <p className="text-xs text-gray-600">{e.notes}</p> : null}
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="text-red-600"
                onClick={() => {
                  deleteFieldJournalEntry(store.id, e.id);
                  refresh();
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>

        <Link href="/agriculture" className="block text-center text-xs text-gray-500">
          ← Agriculture
        </Link>
      </main>
    </>
  );
}
