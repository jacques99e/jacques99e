"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Globe, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { localStore } from "@/lib/db";
import { listAssets } from "@/lib/blockchain";
import { traceUrl } from "@/lib/blockchain-public";
import { createPassport, passportShareText, readPassports } from "@/lib/trace-passport";
import { buildWhatsAppShareUrl } from "@/lib/module-local-tools";
import type { BlockchainAsset } from "@/types";

export default function PassportPage() {
  const store = localStore.get();
  const storeId = store?.id;
  const [assets, setAssets] = useState<BlockchainAsset[]>([]);
  const [passports, setPassports] = useState(() => readPassports(storeId));
  const [productName, setProductName] = useState("");
  const [assetHash, setAssetHash] = useState("");
  const [cooperative, setCooperative] = useState("");
  const [region, setRegion] = useState("");
  const [harvestDate, setHarvestDate] = useState("");
  const [story, setStory] = useState("");

  useEffect(() => {
    if (store) void listAssets(store.id).then(setAssets);
  }, [store]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim() || !assetHash) return;
    setPassports(
      createPassport(
        {
          productName: productName.trim(),
          assetHash,
          cooperative: cooperative.trim() || "Coopérative locale",
          harvestDate: harvestDate || new Date().toISOString().slice(0, 10),
          region: region.trim() || "Afrique de l'Ouest",
          certifications: ["Traçabilité Wazo", "Origine vérifiée"],
          farmerStory: story.trim() || "Produit cultivé avec soin par des producteurs locaux.",
          carbonEstimateKg: Math.round(2 + productName.length * 0.1),
        },
        storeId
      )
    );
    setProductName("");
    setStory("");
  };

  const share = (passport: (typeof passports)[0]) => {
    const link = traceUrl(passport.assetHash);
    const text = passportShareText(passport, link);
    window.open(buildWhatsAppShareUrl(text), "_blank");
  };

  return (
    <div className="min-h-screen bg-[#F5F5F0] pb-24">
      <header className="bg-indigo-900 px-4 py-4 text-white">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <Globe className="h-5 w-5" /> Passeport Produit
          </h1>
          <Link href="/blockchain"><ArrowLeft className="h-4 w-4" /></Link>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 p-4">
        <p className="rounded-2xl bg-indigo-50 p-4 text-xs text-indigo-900">
          Dossier d&apos;origine numérique pour export UE, bailleurs et acheteurs premium — story + GPS + certifications.
        </p>

        <form onSubmit={submit} className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
          <div>
            <Label>Produit</Label>
            <Input value={productName} onChange={(e) => setProductName(e.target.value)} required />
          </div>
          <div>
            <Label>Actif traçabilité</Label>
            <select
              className="w-full rounded-lg border px-3 py-2 text-sm"
              value={assetHash}
              onChange={(e) => setAssetHash(e.target.value)}
              required
            >
              <option value="">Choisir…</option>
              {assets.map((a) => (
                <option key={a.id} value={a.hash_sha256}>{a.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Coopérative</Label>
              <Input value={cooperative} onChange={(e) => setCooperative(e.target.value)} />
            </div>
            <div>
              <Label>Région</Label>
              <Input value={region} onChange={(e) => setRegion(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Date récolte</Label>
            <Input type="date" value={harvestDate} onChange={(e) => setHarvestDate(e.target.value)} />
          </div>
          <div>
            <Label>Histoire producteur</Label>
            <Input value={story} onChange={(e) => setStory(e.target.value)} placeholder="Famille Diallo, 3 générations…" />
          </div>
          <Button type="submit" className="w-full">Émettre le passeport</Button>
        </form>

        {passports.map((p) => (
          <section key={p.id} className="rounded-2xl border border-indigo-200 bg-white p-4 shadow-sm">
            <p className="font-bold text-indigo-900">{p.productName}</p>
            <p className="text-xs text-gray-600">{p.region} — {p.cooperative}</p>
            <p className="mt-2 text-xs text-gray-500">{p.farmerStory}</p>
            <p className="mt-1 text-[10px] text-gray-400">CO₂e estimé : {p.carbonEstimateKg} kg</p>
            <Button type="button" size="sm" className="mt-3 w-full" onClick={() => share(p)}>
              <MessageCircle className="mr-1 h-4 w-4" /> Partager aux acheteurs
            </Button>
          </section>
        ))}
      </main>
    </div>
  );
}
