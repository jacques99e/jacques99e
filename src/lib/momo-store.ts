import type { SupabaseClient } from "@supabase/supabase-js";
import { checkStoreAccess } from "@/lib/api-auth";

export async function resolveMomoStore(
  supabase: SupabaseClient,
  userId: string,
  storeIdParam: string | null | undefined,
  access: "read" | "write" = "read"
): Promise<
  | { ok: true; storeId: string; storeName: string }
  | { ok: false; status: number; error: string }
> {
  if (storeIdParam) {
    const check = await checkStoreAccess(supabase, userId, storeIdParam, access);
    if (!check.ok) {
      return { ok: false, status: check.status ?? 403, error: check.error ?? "Accès refusé." };
    }
    const { data: store } = await supabase
      .from("stores")
      .select("id, name")
      .eq("id", storeIdParam)
      .maybeSingle();
    if (!store) {
      return { ok: false, status: 404, error: "Boutique introuvable." };
    }
    return { ok: true, storeId: store.id, storeName: store.name || "Boutique" };
  }

  const { data: owned } = await supabase
    .from("stores")
    .select("id, name")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (owned?.id) {
    return { ok: true, storeId: owned.id, storeName: owned.name || "Boutique" };
  }

  const { data: membership } = await supabase
    .from("store_members")
    .select("store_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (membership?.store_id) {
    const { data: store } = await supabase
      .from("stores")
      .select("id, name")
      .eq("id", membership.store_id)
      .maybeSingle();
    if (store) {
      return { ok: true, storeId: store.id, storeName: store.name || "Boutique" };
    }
  }

  return { ok: false, status: 404, error: "Boutique introuvable." };
}
