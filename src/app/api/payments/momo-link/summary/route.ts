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

    const today = new Date().toISOString().slice(0, 10);
    const { data: rows, error } = await auth.serviceSupabase
      .from("billing_payments")
      .select("amount, status, payload, updated_at, created_at")
      .eq("store_id", ownedStore.id)
      .eq("method", "momo_link")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const payments = rows ?? [];
    const pending = payments.filter((p) => p.status === "pending").length;
    const paidToday = payments
      .filter(
        (p) =>
          p.status === "succeeded" &&
          String(p.updated_at ?? p.created_at).slice(0, 10) === today
      )
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const recent = payments.slice(0, 5).map((p) => {
      const payload = (p.payload ?? {}) as { label?: string; momo_reference?: string };
      return {
        label: payload.label ?? "Paiement",
        reference: payload.momo_reference ?? "",
        amount: Number(p.amount),
        status: p.status,
      };
    });

    return NextResponse.json({
      success: true,
      pending_count: pending,
      paid_today_fcfa: paidToday,
      recent,
    });
  } catch {
    return NextResponse.json({ success: false, error: "Erreur résumé MoMo." }, { status: 500 });
  }
}
