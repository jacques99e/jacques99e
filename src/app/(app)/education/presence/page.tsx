"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Download, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/contexts/I18nContext";
import { localStore } from "@/lib/db";
import { downloadSimplePdf } from "@/lib/export";
import {
  addAttendanceRecord,
  attendanceRateForSession,
  readAttendance,
  toggleAttendance,
} from "@/lib/education-attendance";

export default function AttendancePage() {
  const { t } = useI18n();
  const storeId = localStore.get()?.id;
  const [records, setRecords] = useState(() => readAttendance(storeId));
  const [courseTitle, setCourseTitle] = useState("");
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().slice(0, 10));
  const [studentName, setStudentName] = useState("");

  const sessions = useMemo(() => {
    const keys = new Set(records.map((r) => `${r.courseTitle}|${r.sessionDate}`));
    return [...keys].map((key) => {
      const [title, date] = key.split("|");
      const stats = attendanceRateForSession(records, title, date);
      return { title, date, ...stats };
    });
  }, [records]);

  const todaySession = useMemo(
    () => records.filter((r) => r.sessionDate === sessionDate && r.courseTitle === courseTitle),
    [records, sessionDate, courseTitle]
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseTitle.trim() || !studentName.trim()) return;
    setRecords(
      addAttendanceRecord(
        {
          courseTitle: courseTitle.trim(),
          sessionDate,
          studentName: studentName.trim(),
          present: true,
          note: "",
        },
        storeId
      )
    );
    setStudentName("");
  };

  const exportPdf = async () => {
    const lines = records
      .filter((r) => r.courseTitle === courseTitle && r.sessionDate === sessionDate)
      .map((r) =>
        `${r.studentName} — ${r.present ? t("presence.present") : t("presence.absent")}`
      );
    await downloadSimplePdf(
      `${t("presence.title")} — ${courseTitle}`,
      [`${t("presence.session")} ${sessionDate}`, "", ...lines],
      `presence-${sessionDate}.pdf`
    );
  };

  return (
    <div className="min-h-screen bg-[#F5F5F0] pb-24">
      <header className="bg-violet-700 px-4 py-4 text-white shadow-sm">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <h1 className="text-lg font-semibold">{t("presence.title")}</h1>
          <Link href="/education" className="text-sm text-white/90">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 p-4">
        <form onSubmit={submit} className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold">{t("presence.newSession")}</h2>
          <div>
            <Label>{t("presence.course")}</Label>
            <Input value={courseTitle} onChange={(e) => setCourseTitle(e.target.value)} required />
          </div>
          <div>
            <Label>{t("presence.date")}</Label>
            <Input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} required />
          </div>
          <div>
            <Label>{t("presence.studentName")}</Label>
            <Input value={studentName} onChange={(e) => setStudentName(e.target.value)} required />
          </div>
          <Button type="submit" className="w-full">
            <UserCheck className="mr-1 h-4 w-4" /> {t("presence.markPresent")}
          </Button>
        </form>

        {courseTitle && todaySession.length > 0 ? (
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                {courseTitle} — {sessionDate}
              </h2>
              <Button type="button" size="sm" variant="outline" onClick={() => void exportPdf()}>
                <Download className="h-3 w-3" />
              </Button>
            </div>
            <ul className="space-y-2">
              {todaySession.map((r) => (
                <li key={r.id} className="flex items-center justify-between rounded-lg border p-2 text-sm">
                  <span>{r.studentName}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant={r.present ? "default" : "outline"}
                    onClick={() => setRecords(toggleAttendance(r.id, storeId))}
                  >
                    <Check className="h-3 w-3" />
                    {r.present ? t("presence.present") : t("presence.absent")}
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {sessions.length > 0 ? (
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold">{t("presence.history")}</h2>
            <ul className="space-y-2 text-xs">
              {sessions.slice(0, 10).map((s) => (
                <li key={`${s.title}-${s.date}`} className="flex justify-between rounded-lg bg-violet-50 p-2">
                  <span>
                    {s.date} — {s.title}
                  </span>
                  <span className="font-medium text-violet-700">
                    {t("presence.rate", { present: s.present, total: s.total, pct: s.rate })}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    </div>
  );
}
