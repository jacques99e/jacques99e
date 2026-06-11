"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { CheckCircle, CreditCard, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

interface PublicPayment {
  reference: string;
  transaction_id: string;
  status: string;
  amount: number;
  currency: string;
  label: string;
  store_name: string;
  checkout_url: string | null;
  simulate_mode?: boolean;
}

export default function PublicPaymentPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const ref = decodeURIComponent(String(params.ref ?? ""));
  const [payment, setPayment] = useState<PublicPayment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paying, setPaying] = useState(false);

  const load = async () => {
    try {
      const res = await fetch(`/api/payments/momo-link/public/${encodeURIComponent(ref)}`);
      const json = (await res.json()) as {
        success: boolean;
        error?: string;
        payment?: PublicPayment;
      };
      if (!res.ok || !json.success || !json.payment) {
        setError(json.error ?? "Lien introuvable.");
        setPayment(null);
        return;
      }
      setPayment(json.payment);
      setError("");
    } catch {
      setError("Impossible de charger le paiement.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [ref]);

  useEffect(() => {
    if (payment?.status !== "pending") return;
    const interval = setInterval(() => void load(), 8000);
    return () => clearInterval(interval);
  }, [payment?.status, ref]);

  const payWithPaydunya = () => {
    if (!payment?.checkout_url) return;
    window.location.href = payment.checkout_url;
  };

  const simulatePay = async () => {
    if (!payment) return;
    setPaying(true);
    try {
      const res = await fetch("/api/payments/momo-link/demo-pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transaction_id: payment.transaction_id }),
      });
      const json = (await res.json()) as { success: boolean };
      if (json.success) await load();
    } finally {
      setPaying(false);
    }
  };

  const returnStatus = searchParams.get("status");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#FFF8F0] px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-center gap-2 text-[#075E54]">
          <CreditCard className="h-8 w-8" />
          <h1 className="text-xl font-bold">Paiement Mobile Money</h1>
        </div>

        {loading ? (
          <p className="flex items-center justify-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
          </p>
        ) : error ? (
          <p className="text-center text-sm text-red-600">{error}</p>
        ) : payment ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-gray-50 p-4 text-center">
              <p className="text-sm text-gray-600">{payment.store_name}</p>
              <p className="mt-1 text-3xl font-bold text-[#075E54]">
                {formatCurrency(payment.amount)}
              </p>
              <p className="mt-1 text-sm text-gray-500">{payment.label}</p>
              <p className="mt-2 text-[10px] text-gray-400">Réf. {payment.reference}</p>
            </div>

            {payment.status === "succeeded" ? (
              <div className="flex flex-col items-center gap-2 rounded-xl bg-green-50 p-4 text-green-800">
                <CheckCircle className="h-10 w-10" />
                <p className="font-semibold">Paiement confirmé</p>
                <p className="text-xs">Merci ! Le commerçant a été notifié.</p>
              </div>
            ) : payment.status === "failed" ? (
              <div className="flex flex-col items-center gap-2 rounded-xl bg-red-50 p-4 text-red-800">
                <XCircle className="h-10 w-10" />
                <p className="font-semibold">Paiement échoué</p>
              </div>
            ) : (
              <>
                {returnStatus === "cancel" ? (
                  <p className="text-center text-xs text-amber-700">Paiement annulé. Vous pouvez réessayer.</p>
                ) : null}
                {payment.simulate_mode ? (
                  <Button className="w-full" onClick={() => void simulatePay()} disabled={paying}>
                    {paying ? "Traitement…" : "Simuler paiement (mode test)"}
                  </Button>
                ) : (
                  <Button className="w-full" onClick={payWithPaydunya} disabled={!payment.checkout_url}>
                    Payer avec Orange / MTN / Moov
                  </Button>
                )}
                <p className="text-center text-[10px] text-gray-400">
                  Paiement sécurisé via PayDunya — Mobile Money Afrique de l&apos;Ouest
                </p>
              </>
            )}
          </div>
        ) : null}

        <p className="mt-6 text-center text-xs text-gray-400">
          Propulsé par{" "}
          <Link href="https://wazo-digital.vercel.app" className="text-[#075E54] underline">
            Wazo Digital
          </Link>
        </p>
      </div>
    </main>
  );
}
