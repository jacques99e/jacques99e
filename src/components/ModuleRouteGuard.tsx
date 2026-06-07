"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useModule } from "@/hooks/useModule";
import { localStore } from "@/lib/db";
import { canAccessPath } from "@/lib/modules/routes";

export function ModuleRouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const storeId = localStore.get()?.id;
  const { modules, loading } = useModule(storeId);

  useEffect(() => {
    if (loading || !pathname) return;
    if (canAccessPath(pathname, modules)) return;
    router.replace("/dashboard");
  }, [loading, modules, pathname, router]);

  if (!loading && pathname && !canAccessPath(pathname, modules)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-wazo-green border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
