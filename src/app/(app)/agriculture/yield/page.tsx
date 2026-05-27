"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useI18n } from "@/contexts/I18nContext";
import { localStore } from "@/lib/db";
import { listParcels, calcYieldPerHectare } from "@/lib/agriculture";
import type { FarmParcel } from "@/types";

export default function YieldPage() {
  const { t } = useI18n();
  const store = localStore.get();
  const [parcels, setParcels] = useState<FarmParcel[]>([]);

  useEffect(() => {
    if (store) listParcels(store.id).then(setParcels);
  }, [store]);

  return (
    <>
      <AppHeader title={t("agriculture.yieldCalc")} />
      <main className="mx-auto max-w-lg space-y-3 p-4">
        {parcels.map((p) => (
          <div key={p.id} className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800">
            <p className="font-medium">{p.name}</p>
            <p className="text-2xl font-bold text-emerald-600">{calcYieldPerHectare(p)} kg/ha</p>
            <p className="text-xs text-gray-500">
              {p.harvested_kg} kg / {p.area_hectares} ha
            </p>
          </div>
        ))}
      </main>
    </>
  );
}
