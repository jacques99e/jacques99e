"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/contexts/I18nContext";
import { localStore } from "@/lib/db";
import { saveCourse } from "@/lib/education";

export default function NewCoursePage() {
  const { t } = useI18n();
  const router = useRouter();
  const store = localStore.get();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store) return;
    const c = await saveCourse(store.id, { title, description });
    router.push(`/education/courses/${encodeURIComponent(c.id)}`);
  };

  return (
    <>
      <AppHeader title={t("education.newCourse")} />
      <main className="mx-auto max-w-lg p-4">
        <form onSubmit={submit} className="space-y-4 rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800">
          <div>
            <Label>{t("products.name")}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required className="mt-1" />
          </div>
          <div>
            <Label>{t("products.description")}</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" />
          </div>
          <Button type="submit" className="w-full">{t("common.save")}</Button>
        </form>
      </main>
    </>
  );
}
