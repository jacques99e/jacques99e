"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Package, Truck } from "lucide-react";

const STEPS = [
  { key: "pending", label: "En attente" },
  { key: "picked_up", label: "Récupéré" },
  { key: "in_transit", label: "En transit" },
  { key: "delivered", label: "Livré" },
] as const;

function stepIndex(status: string): number {
  const idx = STEPS.findIndex((s) => s.key === status);
  return idx >= 0 ? idx : 0;
}

export default function PublicSuiviPage() {
  const params = useParams();
  const code = decodeURIComponent(params.code as string).trim().toUpperCase();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [delivery, setDelivery] = useState<{
    tracking_code: string;
    status: string;
    status_label?: string;
    updated_at: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/logistics/public/${encodeURIComponent(code)}`);
        const json = (await res.json()) as { success: boolean; error?: string; delivery?: typeof delivery };
        if (cancelled) return;
        if (!res.ok || !json.delivery) setError(json.error || "Colis introuvable");
        else setDelivery(json.delivery);
      } catch {
        if (!cancelled) setError("Erreur de chargement");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#FFF8F0]">
        <Loader2 className="h-8 w-8 animate-spin text-[#075E54]" />
      </main>
    );
  }

  if (error || !delivery) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#FFF8F0] px-4">
        <p className="text-sm text-red-600">{error}</p>
        <Link href="/suivi" className="text-sm text-[#075E54] underline">
          Retour
        </Link>
      </main>
    );
  }

  const current = stepIndex(delivery.status);
  const done = delivery.status === "delivered";

  return (
    <main className="min-h-screen bg-[#FFF8F0] px-4 py-6">
      <div className="mx-auto max-w-lg space-y-4">
        <header className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-[#075E54]">Suivi livraison</p>
          <h1 className="font-mono text-lg font-bold">{delivery.tracking_code}</h1>
        </header>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            {done ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <Truck className="h-5 w-5 text-[#075E54]" />}
            <p className="font-semibold">{delivery.status_label || delivery.status}</p>
          </div>
          <ol className="space-y-3">
            {STEPS.map((step, index) => {
              const active = index <= current && delivery.status !== "cancelled";
              return (
                <li key={step.key} className="flex items-center gap-3">
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${active ? "bg-[#075E54] text-white" : "bg-gray-200 text-gray-500"}`}>
                    {index + 1}
                  </span>
                  <span className={active ? "font-medium" : "text-gray-400"}>{step.label}</span>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="rounded-2xl bg-white p-4 text-sm shadow-sm">
          <p className="flex items-center gap-2 font-medium"><Package className="h-4 w-4" /> Adresse</p>
          <p className="mt-1 text-gray-600">{delivery.address}</p>
        </section>

        <p className="text-center text-xs text-gray-500">
          <Link href="/suivi" className="underline">Autre code</Link>
        </p>
      </div>
    </main>
  );
}
