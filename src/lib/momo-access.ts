import type { SupabaseClient } from "@supabase/supabase-js";
import { checkStoreAccess } from "@/lib/api-auth";

/** Vérifie si l'utilisateur peut créer / gérer des liens MoMo pour cette boutique. */
export async function checkMomoLinkAccess(
  supabase: SupabaseClient,
  userId: string,
  storeId: string
): Promise<{ ok: boolean; status?: number; error?: string }> {
  const write = await checkStoreAccess(supabase, userId, storeId, "write");
  if (!write.ok) return write;

  const { data: owner } = await supabase
    .from("stores")
    .select("id")
    .eq("id", storeId)
    .eq("owner_id", userId)
    .maybeSingle();

  if (owner) return { ok: true };

  let member: { role: string; allow_momo_links?: boolean | null } | null = null;

  const withPerm = await supabase
    .from("store_members")
    .select("role, allow_momo_links")
    .eq("store_id", storeId)
    .eq("user_id", userId)
    .maybeSingle();

  if (withPerm.error?.code === "42703" || withPerm.error?.message?.includes("allow_momo_links")) {
    const fallback = await supabase
      .from("store_members")
      .select("role")
      .eq("store_id", storeId)
      .eq("user_id", userId)
      .maybeSingle();
    member = fallback.data;
  } else {
    member = withPerm.data;
  }

  if (!member) {
    return { ok: false, status: 403, error: "Accès refusé." };
  }

  if (member.role === "accountant") {
    return { ok: false, status: 403, error: "Les comptables ne peuvent pas créer de liens MoMo." };
  }

  if (member.allow_momo_links === false) {
    return {
      ok: false,
      status: 403,
      error: "Création de liens MoMo désactivée pour votre compte. Contactez le propriétaire.",
    };
  }

  return { ok: true };
}
