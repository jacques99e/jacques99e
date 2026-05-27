"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/contexts/I18nContext";
import { db } from "@/lib/db";
import { listModules, listEnrollments, generateCertificatePdf } from "@/lib/education";
import type { Course, CourseEnrollment, CourseModule } from "@/types";

export default function CourseDetailPage() {
  const { t } = useI18n();
  const params = useParams();
  const id = decodeURIComponent(params.id as string);
  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [enrollments, setEnrollments] = useState<CourseEnrollment[]>([]);
  const [studentName, setStudentName] = useState("");

  useEffect(() => {
    if (db) db.courses.get(id).then((c) => setCourse(c ?? null));
    listModules(id).then(setModules);
    listEnrollments(id).then(setEnrollments);
  }, [id]);

  const cert = async (name: string) => {
    if (!course) return;
    const blob = await generateCertificatePdf(name, course.title, "Wazo Formateur");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `certificat-${name}.pdf`;
    a.click();
  };

  if (!course) return <p className="p-4">{t("common.loading")}</p>;

  return (
    <>
      <AppHeader title={course.title} />
      <main className="mx-auto max-w-lg space-y-4 p-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">{course.description}</p>

        <section>
          <h2 className="text-sm font-medium mb-2">{t("education.modules")}</h2>
          <ul className="space-y-1 text-sm">
            {modules.map((m) => (
              <li key={m.id} className="rounded bg-white p-2 dark:bg-gray-800">{m.title}</li>
            ))}
            {modules.length === 0 && <p className="text-xs text-gray-400">{t("common.noData")}</p>}
          </ul>
        </section>

        <section className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800 space-y-2">
          <h2 className="text-sm font-medium">{t("education.enroll")}</h2>
          <div className="flex gap-2">
            <Input value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder={t("education.studentName")} />
            <Button size="sm" onClick={() => studentName && cert(studentName)}>{t("education.certificate")}</Button>
          </div>
          <ul className="text-xs space-y-1">
            {enrollments.map((e) => (
              <li key={e.id}>{e.student_name} — {e.progress_percent}%</li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
