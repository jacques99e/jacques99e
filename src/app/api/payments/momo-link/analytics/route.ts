import { NextResponse } from "next/server";
import { checkStoreAccess, requireAuthContext } from "@/lib/api-auth";

export async function GET() {
  try {
    const auth = await requireAuthContext();
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { data: ownedStore } = await auth.serviceSupabase
      .from("stores")
      .select("id")
      .eq("owner_id", auth.userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!ownedStore?.id) {
      return NextResponse.json({ success: false, error: "Boutique introuvable." }, { status: 404 });
    }

    const access = await checkStoreAccess(
      auth.serviceSupabase,
      auth.userId,
      ownedStore.id,
      "read"
    );
    if (!access.ok) {
      return NextResponse.json(
        { success: false, error: access.error },
        { status: access.status ?? 403 }
      );
    }

    const since = new Date();
    since.setDate(since.getDate() - 30);
    const sinceIso = since.toISOString();

    const { data: rows, error } = await auth.serviceSupabase
      .from("billing_payments")
      .select("amount, status, created_at, updated_at, payload")
      .eq("store_id", ownedStore.id)
      .eq("method", "momo_link")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const payments = rows ?? [];
    const paid = payments.filter((p) => p.status === "succeeded");
    const pending = payments.filter((p) => p.status === "pending");
    const failed = payments.filter((p) => p.status === "failed");
    const totalPaidFcfa = paid.reduce((s, p) => s + Number(p.amount), 0);
    const conversionRate =
      payments.length > 0 ? Math.round((paid.length / payments.length) * 100) : 0;

    const today = new Date().toISOString().slice(0, 10);
    const paidToday = paid
      .filter((p) => String(p.updated_at ?? p.created_at).slice(0, 10) === today)
      .reduce((s, p) => s + Number(p.amount), 0);

    const byDay = new Map<string, { paid: number; count: number }>();
    for (const p of paid) {
      const day = String(p.updated_at ?? p.created_at).slice(0, 10);
      const cur = byDay.get(day) ?? { paid: 0, count: 0 };
      cur.paid += Number(p.amount);
      cur.count += 1;
      byDay.set(day, cur);
    }

    const chart = [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([date, v]) => ({ date, amount_fcfa: v.paid, transactions: v.count }));

    const withSale = paid.filter((p) => {
      const pl = (p.payload ?? {}) as { sale_id?: string };
      return Boolean(pl.sale_id);
    }).length;

    return NextResponse.json({
      success: true,
      period_days: 30,
      total_links: payments.length,
      paid_count: paid.length,
      pending_count: pending.length,
      failed_count: failed.length,
      conversion_rate: conversionRate,
      total_paid_fcfa: totalPaidFcfa,
      paid_today_fcfa: paidToday,
      synced_to_caisse: withSale,
      chart,
    });
  } catch {
    return NextResponse.json({ success: false, error: "Erreur analytics MoMo." }, { status: 500 });
  }
}
