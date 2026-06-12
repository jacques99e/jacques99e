import { normalizeBillingStatus, type BillingPlanId, type BillingSubscription } from "@/lib/billing";

export const BILLING_MANAGE_HREF = "/billing";

/** Page abonnement avec plan présélectionné, sans lancer le paiement. */
export function billingChooseHref(plan: "pro" | "business" = "pro"): string {
  return `/billing?plan=${encodeURIComponent(plan)}`;
}

/** Ouvre la page abonnement et lance le paiement MoMo (comme sur la vitrine). */
export function billingPayHref(plan: "pro" | "business" = "pro"): string {
  return `${billingChooseHref(plan)}&pay=1`;
}

export function billingPayHrefForPlan(plan: BillingPlanId): string {
  if (plan === "pro") return billingPayHref("pro");
  if (plan === "business") return billingPayHref("business");
  return BILLING_MANAGE_HREF;
}

/** Lien checkout adapté au plan actuel (PRO par défaut, BUSINESS si déjà PRO). */
export function billingUpgradeHref(sub: BillingSubscription | null): string {
  if (!sub) return billingPayHref("pro");
  const status = normalizeBillingStatus(sub);
  if (status === "active" && sub.plan === "business") return BILLING_MANAGE_HREF;
  if (status === "active" && sub.plan === "pro") return billingPayHref("business");
  return billingPayHref("pro");
}

export function billingDashboardHref(sub: BillingSubscription | null): string {
  if (!sub) return billingPayHref("pro");
  const status = normalizeBillingStatus(sub);
  if (status === "active" && sub.plan !== "starter") return BILLING_MANAGE_HREF;
  return billingPayHref("pro");
}
