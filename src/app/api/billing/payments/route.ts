import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { checkStoreAccess, requireAuthContext } from "@/lib/api-auth";

type BillingPaymentStatus = "pending" | "succeeded" | "failed";

async function resolveStoreId(
  serviceSupabase: SupabaseClient,
  userId: string,
  requestedStoreId: string | null
) {
  if (requestedStoreId) {
    const access = await checkStoreAccess(serviceSupabase, userId, requestedStoreId, "read");
    if (!access.ok) {
      return { ok: false as const, status: access.status ?? 403, error: access.error ?? "Acces refuse." };
    }
    return { ok: true as const, storeId: requestedStoreId };
  }

  const { data: ownedStore } = await serviceSupabase
    .from("stores")
    .select("id")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (ownedStore?.id) {
    return { ok: true as const, storeId: ownedStore.id as string };
  }

  const { data: memberStore } = await serviceSupabase
    .from("store_members")
    .select("store_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!memberStore?.store_id) {
    return { ok: false as const, status: 404, error: "Aucune boutique associee a ce compte." };
  }

  return { ok: true as const, storeId: memberStore.store_id as string };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthContext();
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const storeIdParam = request.nextUrl.searchParams.get("store_id");
    const statusParam = request.nextUrl.searchParams.get("status");
    const planParam = request.nextUrl.searchParams.get("plan");
    const searchParam = request.nextUrl.searchParams.get("q")?.trim();
    const limitParam = Number(request.nextUrl.searchParams.get("limit") ?? "50");
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 200) : 50;

    const resolved = await resolveStoreId(auth.serviceSupabase, auth.userId, storeIdParam);
    if (!resolved.ok) {
      return NextResponse.json({ success: false, error: resolved.error }, { status: resolved.status });
    }

    let query = auth.serviceSupabase
      .from("billing_payments")
      .select("id,store_id,plan,amount,currency,method,provider,provider_tx_id,status,created_at")
      .eq("store_id", resolved.storeId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (statusParam && ["pending", "succeeded", "failed"].includes(statusParam)) {
      query = query.eq("status", statusParam as BillingPaymentStatus);
    }
    if (planParam && ["starter", "pro", "business"].includes(planParam)) {
      query = query.eq("plan", planParam);
    }
    if (searchParam) {
      query = query.or(
        `provider_tx_id.ilike.%${searchParam}%,provider.ilike.%${searchParam}%,method.ilike.%${searchParam}%`
      );
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json(
        { success: false, error: "Impossible de charger l'historique des paiements." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, payments: data ?? [] });
  } catch {
    return NextResponse.json(
      { success: false, error: "Impossible de charger l'historique des paiements." },
      { status: 500 }
    );
  }
}

