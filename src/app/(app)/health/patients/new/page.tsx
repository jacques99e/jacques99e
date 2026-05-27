"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/contexts/I18nContext";
import { localStore } from "@/lib/db";
import { savePatient } from "@/lib/health";

export default function NewPatientPage() {
  const { t } = useI18n();
  const router = useRouter();
  const store = localStore.get();
  const [fullName, setFullName] = useState("");
  const [age, setAge] = useState("");
  const [blood, setBlood] = useState("");
  const [allergies, setAllergies] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store) return;
    await savePatient(store.id, {
      full_name: fullName,
      age: age ? Number(age) : null,
      blood_group: blood || null,
      allergies: allergies || null,
    });
    router.push("/health");
  };

  return (
    <>
      <AppHeader title={t("health.newPatient")} />
      <main className="mx-auto max-w-lg p-4">
        <form onSubmit={submit} className="space-y-4 rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800">
          <div>
            <Label>{t("health.patientName")}</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("health.age")}</Label>
              <Input type="number" value={age} onChange={(e) => setAge(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>{t("health.blood")}</Label>
              <Input value={blood} onChange={(e) => setBlood(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div>
            <Label>{t("health.allergies")}</Label>
            <Input value={allergies} onChange={(e) => setAllergies(e.target.value)} className="mt-1" />
          </div>
          <Button type="submit" className="w-full">{t("common.save")}</Button>
        </form>
      </main>
    </>
  );
}
