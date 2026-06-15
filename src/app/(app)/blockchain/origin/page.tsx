"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileBadge, Shield } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { localStore } from "@/lib/db";
import { downloadOriginCertificatePdf } from "@/lib/blockchain-origin";
import { listAssets } from "@/lib/blockchain";
import { traceUrl } from "@/lib/blockchain-public";
import type { BlockchainAsset } from "@/types";

export default function BlockchainOriginPage() {
  const store = localStore.get();
  const [assets, setAssets] = useState<BlockchainAsset[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    if (store?.id) void listAssets(store.id).then(setAssets);
  }, [store?.id]);

  const download = async (asset: BlockchainAsset) => {
    setLoadingId(asset.id);
    try {
      await downloadOriginCertificatePdf(asset, store?.name || "Wazo Digital");
    } finally {
      setLoadingId(null);
    }
  };

  if (!store) return <p className="p-4 text-sm">Boutique non configurée.</p>;

  return (
    <>
      <AppHeader title="Certificats d'origine" subtitle="Traçabilité" />
      <main className="app-page space-y-4 pb-6">
        <p className="text-xs text-gray-600">
          Générez un PDF officiel par lot ou produit avec hash SHA-256, lien de vérification /trace
          et mention d&apos;ancrage Celo si disponible.
        </p>

        <section className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3 text-xs text-indigo-900">
          <Shield className="mb-1 inline h-4 w-4" />
          Idéal pour export, coopératives et étiquettes QR sur vos produits.
        </section>

        <ul className="space-y-2">
          {assets.map((a) => (
            <li key={a.id} className="app-card space-y-2 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{a.name}</p>
                  <p className="text-xs text-gray-500">{a.asset_type}</p>
                  <a
                    href={traceUrl(a.hash_sha256)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-indigo-600 underline"
                  >
                    Vérifier en ligne
                  </a>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={loadingId === a.id}
                  onClick={() => void download(a)}
                >
                  <FileBadge className="mr-1 h-3 w-3" />
                  {loadingId === a.id ? "…" : "PDF"}
                </Button>
              </div>
            </li>
          ))}
        </ul>

        {assets.length === 0 ? (
          <p className="text-xs text-gray-500">
            Créez d&apos;abord un actif traçable depuis le module blockchain.
          </p>
        ) : null}

        <Link href="/blockchain" className="block text-center text-xs text-gray-500">
          ← Traçabilité
        </Link>
      </main>
    </>
  );
}
