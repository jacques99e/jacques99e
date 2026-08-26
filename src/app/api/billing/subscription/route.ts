import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { checkStoreAccess, requireAuthContext } from "@/lib/api-auth";
import {
  PLAN_LIMITS,
  addDays,
  getTrialDaysLeft,
  normalizeBillingStatus,
  type BillingPlanId,
  type BillingSubscription,
} from "@/lib/billing";
import {
  confirmPaydunyaInvoice,
  getPaymentEnvironmentLabel,
  getPaymentMode,
  hasPaydunyaCredentials,
} from "@/lib/paydunya";

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

async function getOrCreateSubscription(
  serviceSupabase: SupabaseClient,
  storeId: string
): Promise<BillingSubscription> {
  const { data: existing } = await serviceSupabase
    .from("billing_subscriptions")
    .select("store_id,plan,status,trial_start,trial_days,current_period_end,provider")
    .eq("store_id", storeId)
    .maybeSingle();

  if (existing) return existing as BillingSubscription;

  const now = new Date().toISOString();
  const trialStart = now.slice(0, 10);
  const { data: created, error } = await serviceSupabase
    .from("billing_subscriptions")
    .insert({
      store_id: storeId,
      plan: "starter",
      status: "trial",
      trial_start: trialStart,
      trial_days: 14,
      updated_at: now,
    })
    .select("store_id,plan,status,trial_start,trial_days,current_period_end,provider")
    .single();
  if (error || !created) {
    throw new Error("Impossible d'initialiser l'abonnement.");
  }
  return created as BillingSubscription;
}

async function normalizeAndPersistStatus(
  serviceSupabase: SupabaseClient,
  subscription: BillingSubscription
) {
  const normalized = normalizeBillingStatus(subscription);
  if (normalized === subscription.status) return subscription;

  const now = new Date().toISOString();
  const nextPeriodEnd =
    normalized === "expired" && subscription.status === "trial"
      ? addDays(subscription.trial_start, subscription.trial_days)
      : subscription.current_period_end;

  const { data, error } = await serviceSupabase
    .from("billing_subscriptions")
    .update({
      status: normalized,
      current_period_end: nextPeriodEnd,
      updated_at: now,
    })
    .eq("store_id", subscription.store_id)
    .select("store_id,plan,status,trial_start,trial_days,current_period_end,provider")
    .single();
  if (error || !data) return { ...subscription, status: normalized, current_period_end: nextPeriodEnd };
  return data as BillingSubscription;
}

async function reconcileSucceededPayment(
  serviceSupabase: SupabaseClient,
  subscription: BillingSubscription
): Promise<BillingSubscription> {
  if (subscription.status === "active") return subscription;

  const { data: lastSucceeded } = await serviceSupabase
    .from("billing_payments")
    .select("plan,provider,created_at,status")
    .eq("store_id", subscription.store_id)
    .eq("status", "succeeded")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!lastSucceeded) return subscription;

  const now = new Date().toISOString();
  const periodEnd = addDays(now.slice(0, 10), 30);
  const plan = (lastSucceeded.plan as BillingPlanId | undefined) ?? subscription.plan;
  const provider = (lastSucceeded.provider as string | undefined) ?? subscription.provider ?? null;

  const { data, error } = await serviceSupabase
    .from("billing_subscriptions")
    .update({
      plan,
      status: "active",
      current_period_end: periodEnd,
      provider,
      last_payment_at: now,
      updated_at: now,
    })
    .eq("store_id", subscription.store_id)
    .select("store_id,plan,status,trial_start,trial_days,current_period_end,provider")
    .single();

  if (error || !data) {
    return {
      ...subscription,
      plan,
      status: "active",
      current_period_end: periodEnd,
      provider,
    };
  }
  return data as BillingSubscription;
}

async function reconcileByTransaction(
  serviceSupabase: SupabaseClient,
  subscription: BillingSubscription,
  txId: string | null,
  invoiceToken: string | null
): Promise<BillingSubscription> {
  if (!txId || subscription.status === "active") return subscription;

  const { data: payment } = await serviceSupabase
    .from("billing_payments")
    .select("id,plan,provider,status,payload")
    .eq("store_id", subscription.store_id)
    .eq("provider_tx_id", txId)
    .maybeSingle();

  if (!payment) return subscription;

  const paymentStatus = String(payment.status ?? "").toLowerCase();
  if (paymentStatus === "succeeded") {
    return activateSubscriptionFromPayment(serviceSupabase, subscription, payment);
  }
  if (paymentStatus !== "pending") return subscription;

  const mode = getPaymentMode();
  let shouldActivate = false;

  if (mode === "test") {
    shouldActivate = true;
  } else if (hasPaydunyaCredentials()) {
    const payload = (payment.payload ?? {}) as Record<string, unknown>;
    const token =
      invoiceToken?.trim() ||
      (typeof payload.token === "string" ? payload.token : "") ||
      "";
    if (token) {
      const confirmed = await confirmPaydunyaInvoice(token, mode);
      shouldActivate = confirmed.ok;
    }
  }

  if (!shouldActivate) return subscription;

  const now = new Date().toISOString();
  await serviceSupabase
    .from("billing_payments")
    .update({ status: "succeeded", updated_at: now })
    .eq("id", payment.id);

  return activateSubscriptionFromPayment(serviceSupabase, subscription, {
    ...payment,
    status: "succeeded",
  });
}

async function activateSubscriptionFromPayment(
  serviceSupabase: SupabaseClient,
  subscription: BillingSubscription,
  payment: { plan?: unknown; provider?: unknown; status?: unknown }
): Promise<BillingSubscription> {
  const now = new Date().toISOString();
  const periodEnd = addDays(now.slice(0, 10), 30);
  const plan = (payment.plan as BillingPlanId | undefined) ?? subscription.plan;
  const provider = (payment.provider as string | undefined) ?? subscription.provider ?? null;

  const { data, error } = await serviceSupabase
    .from("billing_subscriptions")
    .update({
      plan,
      status: "active",
      current_period_end: periodEnd,
      provider,
      last_payment_at: now,
      updated_at: now,
    })
    .eq("store_id", subscription.store_id)
    .select("store_id,plan,status,trial_start,trial_days,current_period_end,provider")
    .single();

  if (error || !data) {
    return {
      ...subscription,
      plan,
      status: "active",
      current_period_end: periodEnd,
      provider,
    };
  }
  return data as BillingSubscription;
}
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthContext();
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const requestedStoreId = request.nextUrl.searchParams.get("store_id");
    const txId = request.nextUrl.searchParams.get("tx");
    const invoiceToken = request.nextUrl.searchParams.get("token");
    const resolved = await resolveStoreId(auth.serviceSupabase, auth.userId, requestedStoreId);
    if (!resolved.ok) {
      return NextResponse.json({ success: false, error: resolved.error }, { status: resolved.status });
    }

    const subscription = await getOrCreateSubscription(auth.serviceSupabase, resolved.storeId);
    const txReconciled = await reconcileByTransaction(
      auth.serviceSupabase,
      subscription,
      txId,
      invoiceToken
    );
    const reconciled = await reconcileSucceededPayment(auth.serviceSupabase, txReconciled);
    const normalized = await normalizeAndPersistStatus(auth.serviceSupabase, reconciled);
    const trialDaysLeft = getTrialDaysLeft(normalized);
    const limits = PLAN_LIMITS[normalized.plan];
    const paymentMode = getPaymentMode();

    return NextResponse.json({
      success: true,
      subscription: normalized,
      limits,
      trial_days_left: trialDaysLeft,
      payment_mode: paymentMode,
      payment_environment: getPaymentEnvironmentLabel(paymentMode),
      paydunya_ready: hasPaydunyaCredentials(),
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Impossible de charger votre abonnement." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthContext();
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const body = (await request.json()) as { store_id?: string; plan?: BillingPlanId };
    const plan = body.plan;
    if (!plan || !["starter", "pro", "business"].includes(plan)) {
      return NextResponse.json({ success: false, error: "Plan invalide." }, { status: 400 });
    }

    if (plan !== "starter") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Pour activer PRO ou BUSINESS, utilisez le paiement Mobile Money depuis la page Abonnement.",
        },
        { status: 400 }
      );
    }

    const resolved = await resolveStoreId(auth.serviceSupabase, auth.userId, body.store_id ?? null);
    if (!resolved.ok) {
      return NextResponse.json({ success: false, error: resolved.error }, { status: resolved.status });
    }

    const now = new Date().toISOString();
    const existing = await getOrCreateSubscription(auth.serviceSupabase, resolved.storeId);
    const { data, error } = await auth.serviceSupabase
      .from("billing_subscriptions")
      .update({
        plan,
        updated_at: now,
      })
      .eq("store_id", resolved.storeId)
      .select("store_id,plan,status,trial_start,trial_days,current_period_end,provider")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: "Impossible de mettre a jour le plan." },
        { status: 500 }
      );
    }

    const normalized = await normalizeAndPersistStatus(auth.serviceSupabase, data as BillingSubscription);
    return NextResponse.json({
      success: true,
      previous_plan: existing.plan,
      subscription: normalized,
      limits: PLAN_LIMITS[normalized.plan],
      trial_days_left: getTrialDaysLeft(normalized),
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Impossible de mettre a jour l'abonnement." },
      { status: 500 }
    );
  }
}

