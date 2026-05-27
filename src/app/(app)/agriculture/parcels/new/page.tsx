"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/contexts/I18nContext";
import { localStore } from "@/lib/db";
import { saveParcel } from "@/lib/agriculture";

export default function NewParcelPage() {
  const { t } = useI18n();
  const router = useRouter();
  const store = localStore.get();
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [crop, setCrop] = useState("mais");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store) return;
    setLoading(true);
    await saveParcel(store.id, {
      name,
      area_hectares: Number(area),
      crop_type: crop,
      stage: "growth",
    });
    router.push("/agriculture");
    setLoading(false);
  };

  return (
    <>
      <AppHeader title={t("agriculture.newParcel")} />
      <main className="mx-auto max-w-lg p-4">
        <form onSubmit={submit} className="space-y-4 rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800">
          <div>
            <Label>{t("products.name")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required className="mt-1" />
          </div>
          <div>
            <Label>{t("agriculture.area")}</Label>
            <Input type="number" step="0.01" value={area} onChange={(e) => setArea(e.target.value)} required className="mt-1" />
          </div>
          <div>
            <Label>{t("agriculture.crop")}</Label>
            <Input value={crop} onChange={(e) => setCrop(e.target.value)} className="mt-1" />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {t("common.save")}
          </Button>
        </form>
      </main>
    </>
  );
}
