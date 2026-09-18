"use client";

import { Suspense, useEffect, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { ModuleRouteGuard } from "@/components/ModuleRouteGuard";
import { DailyAlertsBanner } from "@/components/DailyAlertsBanner";
import { Day0Mission } from "@/components/Day0Mission";
import { GuidedOnboarding } from "@/components/GuidedOnboarding";
import { PushAlertsRunner } from "@/components/PushAlertsRunner";
import { StoreSwitcher } from "@/components/StoreSwitcher";
import { OfflineBanner } from "@/components/OfflineBanner";
import { LoginForm } from "@/components/LoginForm";
import { useAuth } from "@/hooks/useAuth";
import { useSync } from "@/hooks/useSync";
import { localStore } from "@/lib/db";
import { captureCheckoutIntentFromLocation } from "@/lib/modules/preference";
import { loadUserStore } from "@/lib/store";

function AppSync() {
  useSync();
  return null;
}

function Spinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-wazo-cream">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-wazo-green border-t-transparent" />
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [storeReady, setStoreReady] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [shellReady, setShellReady] = useState(false);

  useEffect(() => {
    setShellReady(true);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      captureCheckoutIntentFromLocation();
      return;
    }

    let cancelled = false;
    (async () => {
      const store = await loadUserStore(user.id);
      if (cancelled) return;
      if (!store) {
        const cached = localStore.get();
        if (!navigator.onLine && cached) {
          setNeedsSetup(false);
          setStoreReady(true);
          return;
        }
        setNeedsSetup(true);
        setStoreReady(true);
        return;
      }

      setNeedsSetup(false);
      setStoreReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [user, loading]);

  if (loading) return <Spinner />;

  if (!user) {
    return (
      <Suspense fallback={<Spinner />}>
        <LoginForm embedded />
      </Suspense>
    );
  }

  if (!storeReady) return <Spinner />;

  if (needsSetup) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#FFF8F0] px-4">
        <a
          href="/setup"
          className="rounded-full bg-[#FF6F00] px-5 py-2.5 text-sm font-semibold text-white"
        >
          Créer ma boutique
        </a>
      </main>
    );
  }

  return (
    <div className="app-shell pb-nav">
      <AppSync />
      <OfflineBanner />
      {shellReady ? (
        <>
          <PushAlertsRunner />
          <StoreSwitcher />
          <DailyAlertsBanner />
          <Day0Mission />
          <GuidedOnboarding />
        </>
      ) : null}
      <ModuleRouteGuard>{children}</ModuleRouteGuard>
      <BottomNav />
    </div>
  );
}
