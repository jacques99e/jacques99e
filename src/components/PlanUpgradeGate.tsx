"use client";

import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { billingPayHref } from "@/lib/billing-checkout";
import type { BillingPlanId } from "@/lib/billing";

interface PlanUpgradeGateProps {
  title: string;
  subtitle?: string;
  message: string;
  requiredPlan: BillingPlanId;
  children?: React.ReactNode;
}

export function PlanUpgradeGate({
  title,
  subtitle,
  message,
  requiredPlan,
  children,
}: PlanUpgradeGateProps) {
  const payHref =
    requiredPlan === "business" ? billingPayHref("business") : billingPayHref("pro");
  const planLabel = requiredPlan === "business" ? "BUSINESS" : "PRO";

  return (
    <>
      <AppHeader title={title} subtitle={subtitle} />
      <main className="app-page pb-6">
        <section className="app-card space-y-4 border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p>{message}</p>
          <div className="flex flex-wrap gap-2">
            <Button asChild className="bg-[#FF6F00] hover:bg-[#FF6F00]/90">
              <Link href={payHref}>Passer au plan {planLabel}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/billing">Voir les tarifs</Link>
            </Button>
          </div>
          {children}
        </section>
      </main>
    </>
  );
}
