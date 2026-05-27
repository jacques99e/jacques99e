"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/contexts/I18nContext";
import { localStore } from "@/lib/db";
import { listCourses } from "@/lib/education";
import type { Course } from "@/types";

export default function EducationPage() {
  const { t } = useI18n();
  const store = localStore.get();
  const [courses, setCourses] = useState<Course[]>([]);

  useEffect(() => {
    if (store) listCourses(store.id).then(setCourses);
  }, [store]);

  return (
    <>
      <AppHeader title={t("modules.education.title")} />
      <main className="mx-auto max-w-lg space-y-4 p-4">
        <Button asChild className="w-full">
          <Link href="/education/courses/new">
            <Plus className="h-4 w-4" />
            {t("education.newCourse")}
          </Link>
        </Button>
        <ul className="space-y-2">
          {courses.map((c) => (
            <li key={c.id}>
              <Link
                href={`/education/courses/${encodeURIComponent(c.id)}`}
                className="block rounded-xl bg-white p-3 shadow-sm dark:bg-gray-800"
              >
                <p className="font-medium">{c.title}</p>
                {c.invite_code && (
                  <p className="text-xs text-gray-500 font-mono">{t("education.invite")}: {c.invite_code}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
