"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";
import { ModuleRouteGuard } from "@/components/ModuleRouteGuard";
import { DailyAlertsBanner } from "@/components/DailyAlertsBanner";
import { GuidedOnboarding } from "@/components/GuidedOnboarding";
import { PushAlertsRunner } from "@/components/PushAlertsRunner";
import { StoreSwitcher } from "@/components/StoreSwitcher";
import { useAuth } from "@/hooks/useAuth";
import { localStore } from "@/lib/db";
import {
  billingCheckoutPath,
  isPaidVitrinePlan,
  readPendingPlan,
  readPendingPlanPay,
} from "@/lib/modules/preference";
import { loadUserStore } from "@/lib/store";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [storeReady, setStoreReady] = useState(() => {
    const s = localStore.get();
    return Boolean(s);
  });

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }

    let cancelled = false;
    (async () => {
      const store = await loadUserStore(user.id);
      if (cancelled) return;
      if (!store) {
        router.replace("/setup");
        return;
      }

      const pendingPlan = readPendingPlan();
      const wantsPay = readPendingPlanPay();
      if (wantsPay && pendingPlan && isPaidVitrinePlan(pendingPlan)) {
        router.replace(billingCheckoutPath(pendingPlan));
        return;
      }

      setStoreReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [user, loading, router]);

  if (loading || (user && !storeReady && !localStore.get())) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-wazo-cream">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-wazo-green border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="app-shell pb-nav">
      <PushAlertsRunner />
      <StoreSwitcher />
      <DailyAlertsBanner />
      <GuidedOnboarding />
      <ModuleRouteGuard>{children}</ModuleRouteGuard>
      <BottomNav />
    </div>
  );
}
