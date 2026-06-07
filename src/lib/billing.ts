export type BillingPlanId = "starter" | "pro" | "business";
export type BillingStatus = "trial" | "active" | "expired";

export interface BillingSubscription {
  store_id: string;
  plan: BillingPlanId;
  status: BillingStatus;
  trial_start: string;
  trial_days: number;
  current_period_end: string | null;
  provider?: string | null;
}

export const PLAN_PRICES: Record<BillingPlanId, number> = {
  starter: 9900,
  pro: 24900,
  business: 49900,
};

export const PLAN_LIMITS: Record<BillingPlanId, { maxProducts: number; maxClients: number }> = {
  starter: { maxProducts: 50, maxClients: 200 },
  pro: { maxProducts: 500, maxClients: 2000 },
  business: { maxProducts: 10000, maxClients: 100000 },
};

export function addDays(dateISO: string, days: number): string {
  const d = new Date(dateISO + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function normalizeBillingStatus(subscription: BillingSubscription): BillingStatus {
  const today = todayISO();
  if (subscription.status === "trial") {
    const trialEnd = addDays(subscription.trial_start, subscription.trial_days);
    return today > trialEnd ? "expired" : "trial";
  }
  if (subscription.status === "active" && subscription.current_period_end) {
    return today > subscription.current_period_end ? "expired" : "active";
  }
  return subscription.status;
}

export function getTrialDaysLeft(subscription: BillingSubscription): number {
  if (normalizeBillingStatus(subscription) !== "trial") return 0;
  const trialEnd = addDays(subscription.trial_start, subscription.trial_days);
  const endMs = new Date(trialEnd + "T00:00:00").getTime();
  const nowMs = new Date(todayISO() + "T00:00:00").getTime();
  return Math.max(0, Math.ceil((endMs - nowMs) / (1000 * 60 * 60 * 24)));
}

