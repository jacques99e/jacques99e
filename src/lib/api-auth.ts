import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

export type StoreAccessLevel = "read" | "write";

export interface AuthContext {
  userId: string;
  serviceSupabase: SupabaseClient;
}

interface AccessResult {
  ok: boolean;
  status?: number;
  error?: string;
}

export type AuthContextResult =
  | { ok: true; userId: string; serviceSupabase: SupabaseClient }
  | { ok: false; status: number; error: string };

function createBearerSupabase(accessToken: string): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

export async function requireAuthContext(): Promise<AuthContextResult> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    return { ok: true, userId: user.id, serviceSupabase: supabase };
  }

  const headerStore = await headers();
  const authHeader = headerStore.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) {
      const bearerSupabase = createBearerSupabase(token);
      const { data, error } = await bearerSupabase.auth.getUser();
      if (!error && data.user) {
        return { ok: true, userId: data.user.id, serviceSupabase: bearerSupabase };
      }
    }
  }

  return { ok: false, status: 401, error: "Session expirée. Veuillez vous reconnecter." };
}

/** Client service role pour lectures/écritures après checkStoreAccess (bypass RLS). */
export async function getAdminSupabase(): Promise<SupabaseClient> {
  return createServiceSupabase();
}

export async function checkStoreAccess(
  serviceSupabase: SupabaseClient,
  userId: string,
  storeId: string,
  access: StoreAccessLevel
): Promise<AccessResult> {
  const { data: ownerStore, error: ownerError } = await serviceSupabase
    .from("stores")
    .select("id")
    .eq("id", storeId)
    .eq("owner_id", userId)
    .maybeSingle();

  if (ownerError) {
    return { ok: false, status: 500, error: "Erreur interne de verification des acces." };
  }
  if (ownerStore) {
    return { ok: true };
  }

  const { data: membership, error: memberError } = await serviceSupabase
    .from("store_members")
    .select("role")
    .eq("store_id", storeId)
    .eq("user_id", userId)
    .maybeSingle();

  if (memberError) {
    return { ok: false, status: 500, error: "Erreur interne de verification des acces." };
  }
  if (!membership) {
    return { ok: false, status: 403, error: "Acces refuse pour cette boutique." };
  }

  if (access === "write") {
    if (membership.role === "accountant") {
      return { ok: false, status: 403, error: "Acces refuse pour cette action." };
    }
    return { ok: true };
  }

  return { ok: true };
}

