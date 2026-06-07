"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { PLAN_LIMITS, getTrialDaysLeft, normalizeBillingStatus, type BillingPlanId, type BillingSubscription } from "@/lib/billing";
import { apiFetch } from "@/lib/api-client";
import { mapErrorToUserMessage } from "@/lib/user-messages";

type PlanId = BillingPlanId;

interface Plan {
  id: PlanId;
  name: string;
  price: string;
  description: string;
  features: string[];
}

const plans: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    price: "9 900 FCFA / mois",
    description: "Pour démarrer rapidement.",
    features: ["Modules essentiels", "Exports CSV/PDF", "Support standard"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "24 900 FCFA / mois",
    description: "Le meilleur choix PME.",
    features: ["Tous les modules", "Mini CRM + relances", "Support prioritaire"],
  },
  {
    id: "business",
    name: "Business",
    price: "Sur devis",
    description: "Pour équipes et multi-sites.",
    features: ["Accompagnement dédié", "Onboarding équipe", "SLA avancé"],
  },
];

interface BillingApiResponse {
  success: boolean;
  subscription?: BillingSubscription;
  trial_days_left?: number;
  payment_mode?: string;
  payment_environment?: string;
  paydunya_ready?: boolean;
}

const emptySubscription: BillingSubscription = {
  store_id: "",
  plan: "starter",
  status: "trial",
  trial_start: new Date().toISOString().slice(0, 10),
  trial_days: 14,
  current_period_end: null,
};

export default function BillingPage() {
  const searchParams = useSearchParams();
  const [subscription, setSubscription] = useState<BillingSubscription>(emptySubscription);
  const [trialDaysLeft, setTrialDaysLeft] = useState(14);
  const [loading, setLoading] = useState(true);
  const [savingPlan, setSavingPlan] = useState<PlanId | null>(null);
  const [payingPlan, setPayingPlan] = useState<PlanId | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [paymentEnvironment, setPaymentEnvironment] = useState("");
  const [paydunyaReady, setPaydunyaReady] = useState(false);

  const currentPlan = subscription.plan;
  const current = useMemo(() => plans.find((plan) => plan.id === currentPlan) ?? plans[0], [currentPlan]);
  const currentStatus = normalizeBillingStatus(subscription);
  const limits = PLAN_LIMITS[currentPlan];

  const loadSubscription = async (txId?: string | null) => {
    setLoading(true);
    setError("");
    try {
      const qs = txId ? `?tx=${encodeURIComponent(txId)}` : "";
      const response = await apiFetch(`/api/billing/subscription${qs}`, { cache: "no-store" });
      const data = (await response.json()) as BillingApiResponse & { error?: string };
      if (!response.ok || !data.success || !data.subscription) {
        throw new Error(data.error || "Impossible de recuperer votre abonnement.");
      }
      setSubscription(data.subscription);
      setTrialDaysLeft(data.trial_days_left ?? getTrialDaysLeft(data.subscription));
      setPaymentEnvironment(data.payment_environment ?? "");
      setPaydunyaReady(Boolean(data.paydunya_ready));
    } catch (e) {
      setError(mapErrorToUserMessage(e, "Impossible de charger votre abonnement."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSubscription();
  }, []);

  useEffect(() => {
    const tx = searchParams.get("tx");
    const status = searchParams.get("status");
    if (!tx) return;
    if (status === "cancelled") {
      setNotice("Paiement annule. Vous pouvez reessayer.");
      return;
    }
    setNotice("Retour de PayDunya detecte. Verification de votre abonnement...");
    const timer = setTimeout(() => {
      void loadSubscription(tx);
    }, 2000);
    return () => clearTimeout(timer);
  }, [searchParams]);

  const selectPlan = async (id: PlanId) => {
    setSavingPlan(id);
    setError("");
    setNotice("");
    try {
      const response = await apiFetch("/api/billing/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: id }),
      });
      const data = (await response.json()) as BillingApiResponse & { error?: string };
      if (!response.ok || !data.success || !data.subscription) {
        throw new Error(data.error || "Impossible de mettre a jour le plan.");
      }
      setSubscription(data.subscription);
      setTrialDaysLeft(data.trial_days_left ?? getTrialDaysLeft(data.subscription));
      setNotice(`Plan ${id.toUpperCase()} selectionne.`);
    } catch (e) {
      setError(mapErrorToUserMessage(e, "Mise a jour du plan impossible."));
    } finally {
      setSavingPlan(null);
    }
  };

  const payPlan = async (id: PlanId) => {
    setPayingPlan(id);
    setError("");
    setNotice("");
    try {
      const target = plans.find((plan) => plan.id === id);
      if (!target) return;
      const amount = id === "starter" ? 9900 : id === "pro" ? 24900 : 49900;
      const response = await apiFetch("/api/payments/momo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          method: "momo",
          plan: id,
        }),
      });
      let data: {
        success?: boolean;
        status?: string;
        error?: string;
        warning?: string;
        paydunya_help?: string;
        checkout_url?: string;
        payment_environment?: string;
      };
      try {
        data = (await response.json()) as typeof data;
      } catch {
        throw new Error(
          response.status === 401
            ? "Session expiree. Veuillez vous reconnecter."
            : `Erreur serveur (${response.status}). Reessayez dans quelques instants.`
        );
      }
      if (!response.ok || !data.success) {
        const detail = [data.error, data.paydunya_help].filter(Boolean).join(" ");
        throw new Error(detail || "Paiement refuse.");
      }
      if (data.warning) {
        setNotice(data.warning);
        await loadSubscription();
        return;
      }
      if (data.checkout_url) {
        setNotice("Redirection vers PayDunya (sandbox) pour finaliser le paiement test...");
        window.location.href = data.checkout_url;
        return;
      }
      if (data.status === "pending") {
        setNotice("Paiement initialise. Validation en cours via le fournisseur.");
      } else {
        setNotice(`Paiement confirme. Plan ${target.name} active.`);
      }
      await loadSubscription();
    } catch (e) {
      const msg = e instanceof Error ? e.message.trim() : "";
      setError(msg ? mapErrorToUserMessage(e, msg) : "Paiement impossible pour le moment.");
    } finally {
      setPayingPlan(null);
    }
  };

  return (
    <>
      <AppHeader title="Abonnement" />
      <main className="mx-auto max-w-lg space-y-4 p-4">
        <section className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800">
          <p className="text-xs text-gray-500">Plan actuel</p>
          <p className="text-lg font-semibold text-[#075E54]">{current.name}</p>
          <p className="text-sm text-gray-700 dark:text-gray-300">{current.price}</p>
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
            Statut:{" "}
            {currentStatus === "trial"
              ? `Essai gratuit (${trialDaysLeft} jour(s) restant(s))`
              : currentStatus === "active"
                ? `Actif jusqu'au ${subscription.current_period_end ?? "-"}`
                : "Expire"}
          </p>
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
            Limites du plan: {limits.maxProducts} produits, {limits.maxClients} clients.
          </p>
          {paymentEnvironment ? (
            <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
              Paiement: {paymentEnvironment}
              {!paydunyaReady ? " — cles PayDunya incompletes." : null}
            </p>
          ) : null}
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
            Votre offre inclut les outils nécessaires pour vos opérations quotidiennes.
          </p>
          {loading ? <p className="mt-2 text-xs text-gray-500">Chargement abonnement...</p> : null}
          {notice ? <p className="mt-2 text-xs text-green-700">{notice}</p> : null}
          {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
          <Button asChild variant="outline" size="sm" className="mt-3">
            <Link href="/billing/history">Voir l'historique des paiements</Link>
          </Button>
        </section>

        <section className="space-y-2">
          {plans.map((plan) => {
            const active = plan.id === currentPlan;
            return (
              <article key={plan.id} className="rounded-xl bg-white p-3 shadow-sm dark:bg-gray-800">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold">{plan.name}</p>
                    <p className="text-xs text-gray-500">{plan.price}</p>
                    <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{plan.description}</p>
                  </div>
                  {active ? (
                    <span className="rounded-full bg-[#075E54]/10 px-2 py-1 text-[11px] text-[#075E54]">
                      Actif
                    </span>
                  ) : null}
                </div>
                <ul className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-300">
                  {plan.features.map((feature) => (
                    <li key={feature}>- {feature}</li>
                  ))}
                </ul>
                <Button
                  variant={active ? "outline" : "default"}
                  size="sm"
                  className="mt-2"
                  onClick={() => void selectPlan(plan.id)}
                  disabled={savingPlan === plan.id}
                >
                  {savingPlan === plan.id ? "Mise a jour..." : active ? "Plan selectionne" : "Choisir ce plan"}
                </Button>
                {plan.id !== "business" ? (
                  <Button
                    size="sm"
                    className="mt-2 ml-2"
                    onClick={() => void payPlan(plan.id)}
                    disabled={payingPlan === plan.id}
                  >
                    {payingPlan === plan.id ? "Paiement..." : "Payer ce plan"}
                  </Button>
                ) : null}
              </article>
            );
          })}
        </section>

        <section className="rounded-xl bg-white p-4 text-xs shadow-sm dark:bg-gray-800">
          <p className="font-semibold">Besoin d'un accompagnement premium ?</p>
          <p className="mt-1 text-gray-600 dark:text-gray-300">
            Nous pouvons configurer vos modules, former votre équipe et suivre vos KPI dès le lancement.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-2">
            <a href="https://wa.me/" target="_blank" rel="noreferrer">
              Parler au conseiller
            </a>
          </Button>
        </section>
      </main>
    </>
  );
}

