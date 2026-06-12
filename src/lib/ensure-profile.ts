import type { SupabaseClient } from "@supabase/supabase-js";
import { mapErrorToUserMessage } from "@/lib/user-messages";

function normalizePhone(phone?: string | null): string | null {
  const trimmed = phone?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Garantit qu'une ligne profiles existe pour l'utilisateur connecté.
 * Tolère : trigger déjà passé, téléphone déjà pris, session requise.
 */
export async function ensureUserProfile(
  supabase: SupabaseClient,
  userId: string,
  phone?: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user?.id || session.user.id !== userId) {
    return {
      ok: false,
      error: "Session expiree. Veuillez vous reconnecter.",
    };
  }

  const normalizedPhone = normalizePhone(phone);

  const { error: rpcError } = await supabase.rpc("ensure_my_profile", {
    p_phone: normalizedPhone,
  });

  if (!rpcError) return { ok: true };

  // RPC absent sur un ancien déploiement Supabase — repli client.
  if (rpcError.code !== "PGRST202" && rpcError.code !== "42883") {
    const msg = mapErrorToUserMessage(rpcError, "");
    if (msg) return { ok: false, error: msg };
  }

  const { data: existing, error: readError } = await supabase
    .from("profiles")
    .select("id, phone")
    .eq("id", userId)
    .maybeSingle();

  if (readError) {
    return {
      ok: false,
      error: mapErrorToUserMessage(
        readError,
        "Impossible de preparer votre profil pour le moment."
      ),
    };
  }

  if (!existing) {
    const { error: insertError } = await supabase.from("profiles").insert({ id: userId });
    if (insertError && insertError.code !== "23505") {
      return {
        ok: false,
        error: mapErrorToUserMessage(
          insertError,
          "Impossible de preparer votre profil pour le moment."
        ),
      };
    }
  }

  if (normalizedPhone && existing?.phone !== normalizedPhone) {
    const { error: phoneError } = await supabase
      .from("profiles")
      .update({ phone: normalizedPhone })
      .eq("id", userId);

    if (phoneError && phoneError.code !== "23505") {
      return {
        ok: false,
        error: mapErrorToUserMessage(
          phoneError,
          "Impossible de preparer votre profil pour le moment."
        ),
      };
    }
  }

  return { ok: true };
}
