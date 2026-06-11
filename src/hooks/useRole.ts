"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { UserRole } from "@/types";

type RoleState = {
  role: UserRole | null;
  loading: boolean;
  canManageModules: boolean;
  canViewAnalytics: boolean;
  canManageSettings: boolean;
  canManageTeam: boolean;
  canWriteSales: boolean;
};

export function useRole(
  userId?: string | null,
  storeMembershipRole?: string | null
): RoleState {
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!userId || !navigator.onLine) {
        setLoading(false);
        return;
      }

      const { data } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
      if (cancelled) return;
      setRole((data?.role as UserRole | undefined) ?? "owner");
      setLoading(false);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return useMemo(() => {
    const normalized = role ?? "owner";
    const member = storeMembershipRole || "owner";
    const isProfileOwner = normalized === "owner";
    const isStoreOwner = member === "owner";
    const isManager = member === "manager";
    const isEmployee = member === "employee";
    const isAccountant = member === "accountant";

    return {
      role: normalized,
      loading,
      canManageModules: isStoreOwner && isProfileOwner,
      canViewAnalytics:
        isStoreOwner || isManager || isEmployee || isAccountant || normalized === "employee",
      canManageSettings: isStoreOwner || isManager,
      canManageTeam: isStoreOwner,
      canWriteSales: isStoreOwner || isManager || isEmployee,
    };
  }, [role, loading, storeMembershipRole]);
}
