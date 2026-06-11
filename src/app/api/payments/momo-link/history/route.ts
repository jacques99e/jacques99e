import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/api-auth";
import { resolveMomoStore } from "@/lib/momo-store";

function mapPaymentRow(row: {
  amount: number;
  status: string;
  payload: unknown;
  provider_tx_id: string;
  created_at: string;
  updated_at: string | null;
}) {
  const payload = (row.payload ?? {}) as {
    label?: string;
    momo_reference?: string;
    customer_phone?: string | null;
    sale_id?: string;
    confirmed_at?: string;
    product_id?: string;
  };

  return {
    transaction_id: row.provider_tx_id,
    reference: payload.momo_reference ?? "",
    label: payload.label ?? "Paiement",
    amount: Number(row.amount),
    status: row.status,
    customer_phone: payload.customer_phone ?? null,
    sale_id: payload.sale_id ?? null,
    product_id: payload.product_id ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at ?? row.created_at,
    paid_at: row.status === "succeeded" ? payload.confirmed_at ?? row.updated_at : null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthContext();
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const storeIdParam = request.nextUrl.searchParams.get("store_id");
    const storeResolved = await resolveMomoStore(
      auth.serviceSupabase,
      auth.userId,
      storeIdParam,
      "read"
    );
    if (!storeResolved.ok) {
      return NextResponse.json(
        { success: false, error: storeResolved.error },
        { status: storeResolved.status }
      );
    }

    const statusFilter = request.nextUrl.searchParams.get("status");
    const limit = Math.min(100, Number(request.nextUrl.searchParams.get("limit") || 50));

    let query = auth.serviceSupabase
      .from("billing_payments")
      .select("amount, status, payload, provider_tx_id, created_at, updated_at")
      .eq("store_id", storeResolved.storeId)
      .eq("method", "momo_link")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (statusFilter && ["pending", "succeeded", "failed"].includes(statusFilter)) {
      query = query.eq("status", statusFilter);
    }

    const { data: rows, error } = await query;

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const payments = (rows ?? []).map(mapPaymentRow);
    const today = new Date().toISOString().slice(0, 10);
    const pending = payments.filter((p) => p.status === "pending").length;
    const paidToday = payments
      .filter((p) => p.status === "succeeded" && String(p.updated_at).slice(0, 10) === today)
      .reduce((sum, p) => sum + p.amount, 0);
    const stalePending = payments.filter((p) => {
      if (p.status !== "pending") return false;
      const age = Date.now() - new Date(p.created_at).getTime();
      return age >= 24 * 60 * 60 * 1000;
    }).length;

    return NextResponse.json({
      success: true,
      store_id: storeResolved.storeId,
      store_name: storeResolved.storeName,
      pending_count: pending,
      paid_today_fcfa: paidToday,
      stale_pending_count: stalePending,
      payments,
      recent: payments.slice(0, 5),
    });
  } catch {
    return NextResponse.json({ success: false, error: "Erreur historique MoMo." }, { status: 500 });
  }
}
