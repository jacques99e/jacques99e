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
  const [isPublic, setIsPublic] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store) return;
    setLoading(true);
    setError("");
    try {
      const c = await saveCourse(store.id, { title, description, is_public: isPublic });
      router.push(`/education/courses/${encodeURIComponent(c.id)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'enregistrer le cours.");
    } finally {
      setLoading(false);
    }
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
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
            />
            Cours public (lien + code invitation pour apprenants)
          </label>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={loading}>
            {t("common.save")}
          </Button>
        </form>
      </main>
    </>
  );
}
