"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Shield, XCircle } from "lucide-react";

export default function PublicTracePage() {
  const params = useParams();
  const hash = decodeURIComponent(params.hash as string).trim();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [asset, setAsset] = useState<{
    name: string;
    asset_type: string;
    hash_sha256: string;
    description: string | null;
    recorded_at: string | null;
    verified: boolean;
    passport?: {
      cooperative?: string;
      region?: string;
      harvestDate?: string;
      certifications?: string[];
      farmerStory?: string;
      carbonEstimateKg?: number;
      productName?: string;
    } | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/blockchain/public/${encodeURIComponent(hash)}`);
        const json = (await res.json()) as { success: boolean; error?: string; asset?: typeof asset };
        if (cancelled) return;
        if (!res.ok || !json.asset) setError(json.error || "Actif introuvable");
        else setAsset(json.asset);
      } catch {
        if (!cancelled) setError("Erreur");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [hash]);

  if (loading) return <main className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-700" /></main>;
  if (error || !asset) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <XCircle className="h-12 w-12 text-red-500" />
        <p className="text-sm text-red-600">{error}</p>
        <Link href="/trace" className="text-sm underline">Retour</Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#FFF8F0] px-4 py-6">
      <div className="mx-auto max-w-lg space-y-4">
        <header className="rounded-2xl bg-white p-4 text-center shadow-sm">
          {asset.verified ? <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" /> : <Shield className="mx-auto h-12 w-12 text-amber-600" />}
          <h1 className="mt-2 text-lg font-bold">{asset.verified ? "Actif authentique" : "Actif enregistré"}</h1>
        </header>
        <section className="rounded-2xl bg-white p-4 text-sm shadow-sm">
          <p className="font-semibold">{asset.name}</p>
          <p className="text-indigo-600">{asset.asset_type}</p>
          {asset.description ? <p className="mt-2 text-gray-600">{asset.description}</p> : null}
          {asset.passport ? (
            <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-900">
              <p className="font-bold">Passeport produit Wazo</p>
              <p className="mt-1">Origine : {asset.passport.region} — {asset.passport.cooperative}</p>
              <p>Récolte : {asset.passport.harvestDate}</p>
              {asset.passport.certifications?.length ? (
                <p>Certifications : {asset.passport.certifications.join(", ")}</p>
              ) : null}
              {asset.passport.carbonEstimateKg ? (
                <p>Empreinte estimée : {asset.passport.carbonEstimateKg} kg CO₂e</p>
              ) : null}
              {asset.passport.farmerStory ? (
                <p className="mt-2 italic">{asset.passport.farmerStory}</p>
              ) : null}
            </div>
          ) : null}
          <p className="mt-3 break-all font-mono text-[10px] text-gray-400">{asset.hash_sha256}</p>
        </section>
        <p className="text-center text-xs"><Link href="/trace" className="underline">Autre vérification</Link></p>
      </div>
    </main>
  );
}
