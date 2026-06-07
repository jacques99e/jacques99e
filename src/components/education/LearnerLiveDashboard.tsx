"use client";

import { useEffect, useMemo, useState } from "react";
import { Radio, RefreshCw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";
import type { CourseEnrollment } from "@/types";

interface LearnerLiveDashboardProps {
  courseId: string;
  initialEnrollments: CourseEnrollment[];
  onRefresh?: () => void;
}

function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Il y a ${hours} h`;
  return new Date(iso).toLocaleDateString("fr-FR");
}

export function LearnerLiveDashboard({
  courseId,
  initialEnrollments,
  onRefresh,
}: LearnerLiveDashboardProps) {
  const [rows, setRows] = useState<CourseEnrollment[]>(initialEnrollments);
  const [live, setLive] = useState(true);
  const [lastEvent, setLastEvent] = useState<Date | null>(null);

  useEffect(() => {
    setRows(initialEnrollments);
  }, [initialEnrollments]);

  useEffect(() => {
    if (!live) return;

    const channel = supabase
      .channel(`enrollments:${courseId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "course_enrollments",
          filter: `course_id=eq.${courseId}`,
        },
        (payload) => {
          setLastEvent(new Date());
          const next = payload.new as CourseEnrollment;
          if (payload.eventType === "DELETE") {
            const old = payload.old as { id?: string };
            if (old.id) setRows((prev) => prev.filter((r) => r.id !== old.id));
            return;
          }
          if (!next?.id) return;
          setRows((prev) => {
            const idx = prev.findIndex((r) => r.id === next.id);
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = { ...copy[idx], ...next };
              return copy.sort((a, b) => (b.progress_percent ?? 0) - (a.progress_percent ?? 0));
            }
            return [next, ...prev].sort(
              (a, b) => (b.progress_percent ?? 0) - (a.progress_percent ?? 0)
            );
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [courseId, live]);

  const stats = useMemo(() => {
    const total = rows.length;
    const completed = rows.filter((r) => (r.progress_percent ?? 0) >= 100).length;
    const active = rows.filter((r) => {
      const p = r.progress_percent ?? 0;
      return p > 0 && p < 100;
    }).length;
    const avg =
      total > 0
        ? Math.round(rows.reduce((s, r) => s + (r.progress_percent ?? 0), 0) / total)
        : 0;
    return { total, completed, active, avg };
  }, [rows]);

  return (
    <section className="space-y-3 rounded-2xl border border-[#075E54]/20 bg-white p-4 shadow-sm dark:bg-gray-800">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[#075E54]">
          <Users className="h-4 w-4" />
          Apprenants en direct
        </h2>
        <div className="flex items-center gap-2">
          {live ? (
            <span className="flex items-center gap-1 text-[10px] font-medium text-green-700">
              <Radio className="h-3 w-3 animate-pulse" />
              Live
            </span>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => {
              setLive((v) => !v);
              onRefresh?.();
            }}
          >
            <RefreshCw className="mr-1 h-3 w-3" />
            {live ? "Pause" : "Reprendre"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center text-xs">
        <div className="rounded-lg bg-gray-50 p-2">
          <p className="font-bold text-[#075E54]">{stats.total}</p>
          <p className="text-gray-500">Total</p>
        </div>
        <div className="rounded-lg bg-gray-50 p-2">
          <p className="font-bold text-amber-700">{stats.active}</p>
          <p className="text-gray-500">En cours</p>
        </div>
        <div className="rounded-lg bg-gray-50 p-2">
          <p className="font-bold text-green-700">{stats.completed}</p>
          <p className="text-gray-500">Terminés</p>
        </div>
        <div className="rounded-lg bg-gray-50 p-2">
          <p className="font-bold text-gray-800">{stats.avg}%</p>
          <p className="text-gray-500">Moyenne</p>
        </div>
      </div>

      {lastEvent ? (
        <p className="text-[10px] text-gray-400">
          Dernière mise à jour : {formatRelativeTime(lastEvent.toISOString())}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="text-xs text-gray-500">Aucun apprenant inscrit pour le moment.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b text-gray-500">
                <th className="py-2 pr-2">Apprenant</th>
                <th className="py-2 pr-2">Contact</th>
                <th className="py-2 pr-2">Progression</th>
                <th className="py-2">Statut</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const percent = row.progress_percent ?? 0;
                const done = percent >= 100;
                return (
                  <tr key={row.id} className="border-b border-gray-100">
                    <td className="py-2 pr-2 font-medium">{row.student_name}</td>
                    <td className="py-2 pr-2 text-gray-600">{row.student_email || "—"}</td>
                    <td className="py-2 pr-2">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-200">
                          <div
                            className={`h-full ${done ? "bg-green-600" : "bg-[#075E54]"}`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <span>{percent}%</span>
                      </div>
                    </td>
                    <td className="py-2">
                      {done ? (
                        <span className="rounded bg-green-100 px-1.5 py-0.5 text-green-800">
                          Certifié
                        </span>
                      ) : percent > 0 ? (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">
                          En cours
                        </span>
                      ) : (
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-600">
                          Nouveau
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
