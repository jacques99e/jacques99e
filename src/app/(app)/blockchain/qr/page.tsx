"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Copy, QrCode } from "lucide-react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { localStore } from "@/lib/db";
import { traceUrl } from "@/lib/blockchain-public";
import { listAssets } from "@/lib/blockchain";
import { shareTraceLink } from "@/lib/module-share";
import type { BlockchainAsset } from "@/types";

export default function BlockchainQrPage() {
  const store = localStore.get();
  const [assets, setAssets] = useState<BlockchainAsset[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (store) void listAssets(store.id).then(setAssets);
  }, [store]);

  const selected = assets.find((a) => a.id === selectedId);

  useEffect(() => {
    if (!selected?.hash_sha256) {
      setQrDataUrl("");
      return;
    }
    const url = traceUrl(selected.hash_sha256);
    void QRCode.toDataURL(url, { width: 220, margin: 2 }).then(setQrDataUrl);
  }, [selected]);

  const copyLink = () => {
    if (!selected) return;
    shareTraceLink({ assetName: selected.name, hash: selected.hash_sha256 });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#F5F5F0] pb-24">
      <header className="bg-indigo-700 px-4 py-4 text-white shadow-sm">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <h1 className="text-lg font-semibold">QR traçabilité</h1>
          <Link href="/blockchain" className="text-sm text-white/90">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 p-4">
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-indigo-800">
            <QrCode className="h-5 w-5" />
            <p className="text-sm text-gray-600">
              Imprimez le QR sur vos étiquettes — le client scanne pour vérifier l&apos;origine sur /trace
            </p>
          </div>
          <div>
            <Label>Actif à étiqueter</Label>
            <select
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              <option value="">Choisir un actif…</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        </section>

        {selected && qrDataUrl ? (
          <section className="flex flex-col items-center rounded-2xl bg-white p-6 shadow-sm">
            <p className="mb-2 text-sm font-semibold">{selected.name}</p>
            <Image src={qrDataUrl} alt="QR traçabilité" width={220} height={220} unoptimized />
            <p className="mt-2 break-all text-center text-[10px] text-gray-500">
              {traceUrl(selected.hash_sha256)}
            </p>
            <Button type="button" className="mt-4 w-full" onClick={copyLink}>
              <Copy className="mr-1 h-4 w-4" />
              {copied ? "Lien copié !" : "Copier lien de vérification"}
            </Button>
          </section>
        ) : (
          <p className="rounded-2xl bg-white p-4 text-center text-sm text-gray-500 shadow-sm">
            {assets.length === 0 ? (
              <>
                Aucun actif.{" "}
                <Link href="/blockchain/assets/new" className="text-indigo-600 underline">
                  Enregistrer un actif
                </Link>
              </>
            ) : (
              "Sélectionnez un actif pour générer le QR."
            )}
          </p>
        )}

        <section className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-xs text-indigo-900">
          <p className="font-semibold">Conseil export</p>
          <p className="mt-1">
            Collez le QR sur sacs de cacao, cartons ou certificats. À la réception, l&apos;acheteur
            vérifie la provenance sans compte Wazo.
          </p>
        </section>
      </main>
    </div>
  );
}
