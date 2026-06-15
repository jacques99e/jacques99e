"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import {
  isBillingUsable,
  normalizeBillingStatus,
  planAllowsAnalytics,
  planAllowsTeam,
  planAllowsWeeklyEmail,
  type BillingPlanId,
  type BillingSubscription,
  type PlanLimits,
} from "@/lib/billing";
import { useActiveStore } from "@/hooks/useActiveStore";

interface BillingApiResponse {
  success: boolean;
  subscription?: BillingSubscription;
  limits?: PlanLimits;
  error?: string;
}

export function useBilling() {
  const { activeStore } = useActiveStore();
  const [subscription, setSubscription] = useState<BillingSubscription | null>(null);
  const [limits, setLimits] = useState<PlanLimits | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!activeStore?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const qs = `?store_id=${encodeURIComponent(activeStore.id)}`;
      const response = await apiFetch(`/api/billing/subscription${qs}`, { cache: "no-store" });
      const data = (await response.json()) as BillingApiResponse;
      if (response.ok && data.success && data.subscription) {
        setSubscription(data.subscription);
        setLimits(data.limits ?? null);
      }
    } catch {
      // Offline — keep previous values.
    } finally {
      setLoading(false);
    }
  }, [activeStore?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const plan: BillingPlanId = subscription?.plan ?? "starter";
  const status = subscription ? normalizeBillingStatus(subscription) : "trial";
  const usable = subscription ? isBillingUsable(subscription) : true;

  return {
    subscription,
    limits,
    plan,
    status,
    usable,
    loading,
    refresh,
    canUseAnalytics: usable && planAllowsAnalytics(plan),
    canUseTeam: usable && planAllowsTeam(plan),
    canUseWeeklyEmail: usable && planAllowsWeeklyEmail(plan),
  };
}
