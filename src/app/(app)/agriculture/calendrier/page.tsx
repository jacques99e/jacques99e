"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Calendar, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { localStore } from "@/lib/db";
import {
  addCulturalTask,
  presetTasksForCrop,
  readCulturalTasks,
  toggleCulturalTask,
  upcomingTasks,
} from "@/lib/agriculture-calendar";

const CROPS = ["Maïs", "Cacao", "Café", "Anacarde", "Riz", "Autre"];

export default function CulturalCalendarPage() {
  const storeId = localStore.get()?.id;
  const [tasks, setTasks] = useState(() => readCulturalTasks(storeId));
  const [crop, setCrop] = useState("Maïs");
  const [task, setTask] = useState("");
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");

  const upcoming = useMemo(() => upcomingTasks(tasks), [tasks]);
  const presets = presetTasksForCrop(crop);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!task.trim()) return;
    setTasks(
      addCulturalTask(
        { crop, task: task.trim(), dueDate, done: false, note: note.trim() },
        storeId
      )
    );
    setTask("");
    setNote("");
  };

  const addPreset = (preset: string, offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    setTasks(
      addCulturalTask(
        {
          crop,
          task: preset,
          dueDate: d.toISOString().slice(0, 10),
          done: false,
          note: "",
        },
        storeId
      )
    );
  };

  return (
    <div className="min-h-screen bg-[#F5F5F0] pb-24">
      <header className="bg-emerald-800 px-4 py-4 text-white shadow-sm">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <h1 className="text-lg font-semibold">Calendrier cultural</h1>
          <Link href="/agriculture" className="text-sm text-white/90">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 p-4">
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-emerald-800">
            <Calendar className="h-4 w-4" />
            <h2 className="text-sm font-semibold">14 prochains jours ({upcoming.length})</h2>
          </div>
          {upcoming.length === 0 ? (
            <p className="mt-2 text-xs text-gray-500">Aucune tâche planifiée.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {upcoming.map((t) => (
                <li key={t.id} className="flex items-center justify-between rounded-lg bg-emerald-50 p-3 text-xs">
                  <div>
                    <p className="font-medium">
                      {t.dueDate} — {t.crop}: {t.task}
                    </p>
                    {t.note ? <p className="text-gray-500">{t.note}</p> : null}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setTasks(toggleCulturalTask(t.id, storeId))}
                  >
                    <Check className="h-3 w-3" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <form onSubmit={submit} className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold">Ajouter une tâche</h2>
          <div>
            <Label>Culture</Label>
            <select
              className="w-full rounded-lg border px-3 py-2 text-sm"
              value={crop}
              onChange={(e) => setCrop(e.target.value)}
            >
              {CROPS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Tâche</Label>
            <Input value={task} onChange={(e) => setTask(e.target.value)} required />
          </div>
          <div>
            <Label>Date prévue</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
          </div>
          <div>
            <Label>Note</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <Button type="submit" className="w-full">
            Planifier
          </Button>
        </form>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold">Modèle {crop}</h2>
          <p className="mb-2 text-xs text-gray-500">Ajoutez rapidement les étapes types :</p>
          <div className="flex flex-wrap gap-2">
            {presets.map((preset, i) => (
              <Button
                key={preset}
                type="button"
                size="sm"
                variant="outline"
                onClick={() => addPreset(preset, i * 14)}
              >
                {preset}
              </Button>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
