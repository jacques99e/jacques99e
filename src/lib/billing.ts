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
  starter: 0,
  pro: 6550,
  business: 16350,
};

export interface PlanLimits {
  maxProducts: number;
  maxClients: number;
  maxStores: number;
}

export const PLAN_LIMITS: Record<BillingPlanId, PlanLimits> = {
  starter: { maxProducts: 50, maxClients: 200, maxStores: 1 },
  pro: { maxProducts: 999_999, maxClients: 2000, maxStores: 3 },
  business: { maxProducts: 999_999, maxClients: 100_000, maxStores: 10 },
};

const PLAN_RANK: Record<BillingPlanId, number> = {
  starter: 0,
  pro: 1,
  business: 2,
};

export function highestBillingPlan(plans: BillingPlanId[]): BillingPlanId {
  if (!plans.length) return "starter";
  return plans.reduce(
    (best, plan) => (PLAN_RANK[plan] > PLAN_RANK[best] ? plan : best),
    "starter" as BillingPlanId
  );
}

export function planAllowsAnalytics(plan: BillingPlanId): boolean {
  return plan === "pro" || plan === "business";
}

export function planAllowsTeam(plan: BillingPlanId): boolean {
  return plan === "business";
}

export function planAllowsWeeklyEmail(plan: BillingPlanId): boolean {
  return plan === "business";
}

export function isBillingUsable(subscription: BillingSubscription): boolean {
  return normalizeBillingStatus(subscription) !== "expired";
}

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

export function isPaidSubscriber(subscription: BillingSubscription | null | undefined): boolean {
  if (!subscription) return false;
  return (
    normalizeBillingStatus(subscription) === "active" &&
    (subscription.plan === "pro" || subscription.plan === "business")
  );
}

export function getTrialDaysLeft(subscription: BillingSubscription): number {
  if (normalizeBillingStatus(subscription) !== "trial") return 0;
  const trialEnd = addDays(subscription.trial_start, subscription.trial_days);
  const endMs = new Date(trialEnd + "T00:00:00").getTime();
  const nowMs = new Date(todayISO() + "T00:00:00").getTime();
  return Math.max(0, Math.ceil((endMs - nowMs) / (1000 * 60 * 60 * 24)));
}

