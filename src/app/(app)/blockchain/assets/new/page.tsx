"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/contexts/I18nContext";
import { localStore } from "@/lib/db";
import { createAsset } from "@/lib/blockchain";

export default function NewBlockchainAssetPage() {
  const { t } = useI18n();
  const router = useRouter();
  const store = localStore.get();
  const [name, setName] = useState("");
  const [assetType, setAssetType] = useState("recolte");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store) return;
    setLoading(true);
    try {
      let latitude: number | undefined;
      let longitude: number | undefined;
      if (navigator.geolocation) {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
        ).catch(() => null);
        if (pos) {
          latitude = pos.coords.latitude;
          longitude = pos.coords.longitude;
        }
      }
      await createAsset(store.id, {
        name,
        asset_type: assetType,
        description,
        latitude,
        longitude,
      });
      router.push("/blockchain");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <AppHeader title={t("blockchain.newAsset")} />
      <main className="mx-auto max-w-lg p-4">
        <form onSubmit={submit} className="space-y-4 rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800">
          <div>
            <Label>{t("products.name")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required className="mt-1" />
          </div>
          <div>
            <Label>{t("blockchain.assetType")}</Label>
            <select
              value={assetType}
              onChange={(e) => setAssetType(e.target.value)}
              className="mt-1 flex h-11 w-full rounded-lg border px-3"
            >
              <option value="recolte">Récolte</option>
              <option value="betail">Bétail</option>
              <option value="materiel">Matériel</option>
            </select>
          </div>
          <div>
            <Label>{t("products.description")}</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t("common.loading") : t("blockchain.tokenize")}
          </Button>
        </form>
      </main>
    </>
  );
}
