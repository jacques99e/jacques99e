"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import {
  PLAN_LIMITS,
  getTrialDaysLeft,
  normalizeBillingStatus,
  type BillingPlanId,
  type BillingSubscription,
} from "@/lib/billing";
import {
  VITRINE_PLANS,
  mapVitrinePlanToBilling,
  paymentFcfaForPlan,
  vitrinePlanByBillingId,
} from "@/lib/vitrine-plans";
import { applyPendingPlan, applyPendingPlanPay } from "@/lib/modules/preference";
import { apiFetch } from "@/lib/api-client";
import { mapErrorToUserMessage } from "@/lib/user-messages";

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
  const [savingPlan, setSavingPlan] = useState<BillingPlanId | null>(null);
  const [payingPlan, setPayingPlan] = useState<BillingPlanId | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [paymentEnvironment, setPaymentEnvironment] = useState("");
  const [paydunyaReady, setPaydunyaReady] = useState(false);

  const currentPlan = subscription.plan;
  const current = useMemo(() => vitrinePlanByBillingId(currentPlan), [currentPlan]);
  const currentStatus = normalizeBillingStatus(subscription);
  const limits = PLAN_LIMITS[currentPlan];

  const loadSubscription = async (
    txId?: string | null,
    invoiceToken?: string | null
  ): Promise<BillingSubscription | null> => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (txId) params.set("tx", txId);
      if (invoiceToken) params.set("token", invoiceToken);
      const qs = params.toString() ? `?${params.toString()}` : "";
      const response = await apiFetch(`/api/billing/subscription${qs}`, { cache: "no-store" });
      const data = (await response.json()) as BillingApiResponse & { error?: string };
      if (!response.ok || !data.success || !data.subscription) {
        throw new Error(data.error || "Impossible de récupérer votre abonnement.");
      }
      setSubscription(data.subscription);
      setTrialDaysLeft(data.trial_days_left ?? getTrialDaysLeft(data.subscription));
      setPaymentEnvironment(data.payment_environment ?? "");
      setPaydunyaReady(Boolean(data.paydunya_ready));
      return data.subscription;
    } catch (e) {
      setError(mapErrorToUserMessage(e, "Impossible de charger votre abonnement."));
      return null;
    } finally {
      setLoading(false);
    }
  };

  const selectPlan = async (id: BillingPlanId, silent = false) => {
    setSavingPlan(id);
    if (!silent) {
      setError("");
      setNotice("");
    }
    try {
      const response = await apiFetch("/api/billing/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: id }),
      });
      const data = (await response.json()) as BillingApiResponse & { error?: string };
      if (!response.ok || !data.success || !data.subscription) {
        throw new Error(data.error || "Impossible de mettre à jour le plan.");
      }
      setSubscription(data.subscription);
      setTrialDaysLeft(data.trial_days_left ?? getTrialDaysLeft(data.subscription));
      const label = vitrinePlanByBillingId(id).title;
      setNotice(silent ? `Plan ${label} présélectionné depuis la vitrine.` : `Plan ${label} sélectionné.`);
    } catch (e) {
      if (!silent) {
        setError(mapErrorToUserMessage(e, "Mise à jour du plan impossible."));
      }
    } finally {
      setSavingPlan(null);
    }
  };

  const payPlan = async (id: BillingPlanId) => {
    setPayingPlan(id);
    setError("");
    setNotice("");
    try {
      const amount = paymentFcfaForPlan(id);
      if (amount <= 0) {
        await selectPlan(id);
        setNotice("Plan GRATUIT activé — passez au PRO quand vous êtes prêt.");
        return;
      }
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
            ? "Session expirée. Veuillez vous reconnecter."
            : `Erreur serveur (${response.status}). Réessayez dans quelques instants.`
        );
      }
      if (!response.ok || !data.success) {
        const detail = [data.error, data.paydunya_help].filter(Boolean).join(" ");
        throw new Error(detail || "Paiement refusé.");
      }
      if (data.warning) {
        setNotice(data.warning);
        await loadSubscription();
        return;
      }
      if (data.checkout_url) {
        setNotice("Redirection vers le paiement Mobile Money...");
        window.location.href = data.checkout_url;
        return;
      }
      if (data.status === "pending") {
        setNotice("Paiement initialisé. Validation en cours.");
      } else {
        setNotice(`Paiement confirmé. Plan ${vitrinePlanByBillingId(id).title} activé.`);
      }
      await loadSubscription();
    } catch (e) {
      const msg = e instanceof Error ? e.message.trim() : "";
      setError(msg ? mapErrorToUserMessage(e, msg) : "Paiement impossible pour le moment.");
    } finally {
      setPayingPlan(null);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const runCheckoutIntent = async () => {
      const currentSub = await loadSubscription();
      if (cancelled) return;

      const urlPlan = searchParams.get("plan");
      const urlPay = searchParams.get("pay") === "1";
      if (!urlPlan && !urlPay) return;

      const pending = urlPlan ?? applyPendingPlan();
      if (urlPay) applyPendingPlanPay();
      const billingPlan = mapVitrinePlanToBilling(pending);
      if (!billingPlan || billingPlan === "starter") return;

      const currentStatus = currentSub ? normalizeBillingStatus(currentSub) : "expired";
      const alreadyOnPlan =
        currentSub?.plan === billingPlan &&
        currentStatus === "active" &&
        Boolean(currentSub.current_period_end);

      if (urlPay && paymentFcfaForPlan(billingPlan) > 0 && !alreadyOnPlan) {
        await payPlan(billingPlan);
      } else if (!alreadyOnPlan) {
        await selectPlan(billingPlan, true);
      }
    };

    void runCheckoutIntent();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- checkout intent once on mount
  }, []);

  useEffect(() => {
    const tx = searchParams.get("tx");
    const token = searchParams.get("token");
    const status = searchParams.get("status");
    if (!tx && !token) return;
    if (status === "cancelled") {
      setNotice("Paiement annulé. Vous pouvez réessayer.");
      return;
    }
    setNotice("Retour de paiement détecté. Vérification de votre abonnement...");
    const timer = setTimeout(() => {
      void loadSubscription(tx, token);
    }, 2000);
    return () => clearTimeout(timer);
  }, [searchParams]);

  return (
    <>
      <AppHeader title="Abonnement" />
      <main className="mx-auto max-w-lg space-y-4 p-4">
        <p className="text-center text-sm text-gray-600">
          Tarifs identiques à la vitrine — gratuit pour démarrer, PRO à 9,99 €/mois sans engagement.
        </p>

        <section className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800">
          <p className="text-xs text-gray-500">Plan actuel</p>
          <p className="text-lg font-semibold text-[#075E54]">{current.title}</p>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {current.priceLabel}
            {current.priceSuffix}
          </p>
          <p className="mt-1 text-xs text-[#FF6F00]">{current.hook}</p>
          <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">
            Statut :{" "}
            {currentStatus === "trial"
              ? `Essai gratuit (${trialDaysLeft} jour(s) restant(s))`
              : currentStatus === "active"
                ? `Actif jusqu'au ${subscription.current_period_end ?? "-"}`
                : "Expiré — repassez au PRO pour débloquer tout"}
          </p>
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
            Limites : {limits.maxProducts >= 999_999 ? "produits illimités" : `${limits.maxProducts} produits`}
            , {limits.maxClients} clients, {limits.maxStores} boutique{limits.maxStores > 1 ? "s" : ""}.
          </p>
          {paymentEnvironment ? (
            <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
              Paiement : {paymentEnvironment}
              {!paydunyaReady ? " — clés PayDunya incomplètes." : null}
            </p>
          ) : null}
          {loading ? <p className="mt-2 text-xs text-gray-500">Chargement...</p> : null}
          {notice ? <p className="mt-2 text-xs text-green-700">{notice}</p> : null}
          {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
          <Button asChild variant="outline" size="sm" className="mt-3">
            <Link href="/billing/history">Historique des paiements</Link>
          </Button>
        </section>

        <section className="space-y-3">
          {VITRINE_PLANS.map((plan) => {
            const active = plan.billingId === currentPlan;
            return (
              <article
                key={plan.billingId}
                className={`rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800 ${
                  plan.popular
                    ? "ring-2 ring-[#075E54]/25"
                    : plan.teamsPick
                      ? "ring-2 ring-[#075E54]/15"
                      : ""
                }`}
              >
                {plan.popular ? (
                  <span className="mb-2 inline-block rounded-full bg-[#FF6F00] px-2 py-0.5 text-[10px] font-bold text-white">
                    Recommandé
                  </span>
                ) : plan.badge ? (
                  <span className="mb-2 inline-block rounded-full bg-[#075E54] px-2 py-0.5 text-[10px] font-bold text-white">
                    {plan.badge}
                  </span>
                ) : null}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[#075E54]">{plan.title}</p>
                    <p className="text-xs text-gray-500">{plan.subtitle}</p>
                    <p className="mt-1 text-lg font-bold">
                      {plan.priceLabel}
                      <span className="text-sm font-normal text-gray-500">{plan.priceSuffix}</span>
                    </p>
                    {plan.paymentFcfa > 0 ? (
                      <p className="text-[11px] text-gray-500">
                        ≈ {plan.paymentFcfa.toLocaleString("fr-FR")} FCFA via MoMo
                      </p>
                    ) : null}
                  </div>
                  {active ? (
                    <span className="shrink-0 rounded-full bg-[#075E54]/10 px-2 py-1 text-[11px] text-[#075E54]">
                      Actif
                    </span>
                  ) : null}
                </div>
                <ul className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-300">
                  {plan.features.map((feature) => (
                    <li key={feature}>✓ {feature}</li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  {plan.paymentFcfa > 0 ? (
                    <Button
                      variant={active ? "outline" : plan.popular || plan.teamsPick ? "default" : "outline"}
                      size="sm"
                      className={
                        !active && plan.popular
                          ? "bg-[#FF6F00] hover:bg-[#FF6F00]/90"
                          : !active && plan.teamsPick
                            ? "bg-[#075E54] hover:bg-[#075E54]/90"
                            : ""
                      }
                      onClick={() => void payPlan(plan.billingId)}
                      disabled={payingPlan === plan.billingId || active}
                    >
                      {payingPlan === plan.billingId
                        ? "..."
                        : active
                          ? "Plan actuel"
                          : `Payer — ${plan.cta}`}
                    </Button>
                  ) : (
                    <Button
                      variant={active ? "outline" : "outline"}
                      size="sm"
                      onClick={() => void selectPlan(plan.billingId)}
                      disabled={savingPlan === plan.billingId || active}
                    >
                      {savingPlan === plan.billingId ? "..." : active ? "Plan actuel" : plan.cta}
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </section>

        <section className="rounded-xl bg-[#075E54]/5 p-4 text-xs">
          <p className="font-semibold text-[#075E54]">Comme sur la vitrine</p>
          <p className="mt-1 text-gray-600">
            Caisse MoMo, mode hors ligne, crédit client, boutique WhatsApp et 6 modules métier —
            upgrade ou downgrade à tout moment.
          </p>
        </section>
      </main>
    </>
  );
}
