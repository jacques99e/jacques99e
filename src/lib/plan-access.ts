import type { SupabaseClient } from "@supabase/supabase-js";
import {
  highestBillingPlan,
  PLAN_LIMITS,
  type BillingPlanId,
  type PlanLimits,
} from "@/lib/billing";

export interface OwnerStoreAccess {
  ownedCount: number;
  effectivePlan: BillingPlanId;
  limits: PlanLimits;
  canCreateStore: boolean;
}

export async function getStoreBillingPlan(
  serviceSupabase: SupabaseClient,
  storeId: string
): Promise<BillingPlanId> {
  const { data } = await serviceSupabase
    .from("billing_subscriptions")
    .select("plan")
    .eq("store_id", storeId)
    .maybeSingle();
  const plan = data?.plan as BillingPlanId | undefined;
  if (plan === "pro" || plan === "business" || plan === "starter") return plan;
  return "starter";
}

export async function getOwnerStoreAccess(
  serviceSupabase: SupabaseClient,
  userId: string
): Promise<OwnerStoreAccess> {
  const { data: ownedStores, error } = await serviceSupabase
    .from("stores")
    .select("id")
    .eq("owner_id", userId);

  if (error) throw new Error(error.message);

  const storeIds = (ownedStores || []).map((row) => row.id as string);
  const ownedCount = storeIds.length;

  let effectivePlan: BillingPlanId = "starter";
  if (storeIds.length) {
    const { data: subscriptions } = await serviceSupabase
      .from("billing_subscriptions")
      .select("plan")
      .in("store_id", storeIds);
    const plans = (subscriptions || [])
      .map((row) => row.plan as BillingPlanId)
      .filter((plan): plan is BillingPlanId =>
        plan === "starter" || plan === "pro" || plan === "business"
      );
    effectivePlan = highestBillingPlan(plans.length ? plans : ["starter"]);
  }

  const limits = PLAN_LIMITS[effectivePlan];
  return {
    ownedCount,
    effectivePlan,
    limits,
    canCreateStore: ownedCount < limits.maxStores,
  };
}

export async function assertStoreBillingFeature(
  serviceSupabase: SupabaseClient,
  storeId: string,
  feature: "analytics" | "team" | "weekly_email"
): Promise<{ ok: true; plan: BillingPlanId } | { ok: false; error: string; plan: BillingPlanId }> {
  const plan = await getStoreBillingPlan(serviceSupabase, storeId);

  if (feature === "analytics" && plan !== "pro" && plan !== "business") {
    return {
      ok: false,
      plan,
      error: "Analytics et exports PDF réservés au plan PRO ou BUSINESS.",
    };
  }
  if ((feature === "team" || feature === "weekly_email") && plan !== "business") {
    return {
      ok: false,
      plan,
      error:
        feature === "team"
          ? "Équipe et rôles réservés au plan BUSINESS."
          : "Rapport hebdomadaire par e-mail réservé au plan BUSINESS.",
    };
  }

  return { ok: true, plan };
}
