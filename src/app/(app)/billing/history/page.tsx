"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api-client";
import { formatCurrency } from "@/lib/utils";
import { mapErrorToUserMessage } from "@/lib/user-messages";

interface BillingPaymentItem {
  id: string;
  plan: "starter" | "pro" | "business";
  amount: number;
  currency: string;
  method: string;
  provider: string;
  provider_tx_id: string | null;
  status: "pending" | "succeeded" | "failed";
  created_at: string | null;
}

const statusClasses: Record<BillingPaymentItem["status"], string> = {
  pending: "bg-amber-50 text-amber-700",
  succeeded: "bg-emerald-50 text-emerald-700",
  failed: "bg-red-50 text-red-700",
};

export default function BillingHistoryPage() {
  const [payments, setPayments] = useState<BillingPaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("all");
  const [plan, setPlan] = useState("all");
  const [search, setSearch] = useState("");

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (status !== "all") params.set("status", status);
      if (plan !== "all") params.set("plan", plan);
      if (search.trim()) params.set("q", search.trim());
      const qs = params.toString();
      const response = await apiFetch(`/api/billing/payments${qs ? `?${qs}` : ""}`, { cache: "no-store" });
      const data = (await response.json()) as { success?: boolean; error?: string; payments?: BillingPaymentItem[] };
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Impossible de charger l'historique des paiements.");
      }
      setPayments(data.payments ?? []);
    } catch (e) {
      setError(mapErrorToUserMessage(e, "Impossible de charger l'historique des paiements."));
    } finally {
      setLoading(false);
    }
  }, [status, plan, search]);

  useEffect(() => {
    void loadPayments();
  }, [loadPayments]);

  const totalSucceeded = useMemo(
    () => payments.filter((p) => p.status === "succeeded").reduce((sum, p) => sum + Number(p.amount || 0), 0),
    [payments]
  );

  return (
    <>
      <AppHeader title="Historique des paiements" />
      <main className="mx-auto max-w-lg space-y-4 p-4">
        <section className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800">
          <p className="text-xs text-gray-500">Total paiements reussis</p>
          <p className="text-lg font-semibold text-[#075E54]">{formatCurrency(totalSucceeded)}</p>
          <p className="mt-1 text-xs text-gray-500">{payments.length} transaction(s) chargees</p>
        </section>

        <section className="space-y-2 rounded-xl bg-white p-3 shadow-sm dark:bg-gray-800">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher: reference, fournisseur, methode"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm"
            >
              <option value="all">Tous statuts</option>
              <option value="succeeded">Reussi</option>
              <option value="pending">En attente</option>
              <option value="failed">Echoue</option>
            </select>
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm"
            >
              <option value="all">Tous plans</option>
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="business">Business</option>
            </select>
          </div>
          <Button size="sm" variant="outline" onClick={() => void loadPayments()}>
            Actualiser
          </Button>
        </section>

        {loading ? <p className="text-center text-xs text-gray-500">Chargement des paiements...</p> : null}
        {error ? <p className="rounded-lg bg-red-50 p-2 text-xs text-red-700">{error}</p> : null}

        {!loading && !error && payments.length === 0 ? (
          <p className="rounded-xl bg-white p-4 text-center text-sm text-gray-500 shadow-sm dark:bg-gray-800">
            Aucun paiement pour le moment.
          </p>
        ) : null}

        <ul className="space-y-2">
          {payments.map((p) => (
            <li key={p.id} className="rounded-xl bg-white p-3 shadow-sm dark:bg-gray-800">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{formatCurrency(Number(p.amount || 0))}</p>
                  <p className="text-xs text-gray-500">
                    {p.method} · {p.provider} · plan {p.plan.toUpperCase()}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-1 text-[11px] ${statusClasses[p.status]}`}>{p.status}</span>
              </div>
              <p className="mt-1 text-[11px] text-gray-500">
                Ref: {p.provider_tx_id || "-"} ·{" "}
                {p.created_at ? new Date(p.created_at).toLocaleString("fr-FR") : "-"}
              </p>
            </li>
          ))}
        </ul>

        <Button asChild variant="outline" className="w-full">
          <Link href="/billing">Retour a l'abonnement</Link>
        </Button>
      </main>
    </>
  );
}

