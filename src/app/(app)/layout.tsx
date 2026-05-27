"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { localStore } from "@/lib/db";
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
      } else {
        setStoreReady(true);
      }
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
    <div className="min-h-screen pb-nav">
      {children}
      <BottomNav />
    </div>
  );
}
