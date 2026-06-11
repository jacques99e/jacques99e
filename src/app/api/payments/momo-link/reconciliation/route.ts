import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/api-auth";
import { buildReconciliationReport } from "@/lib/momo-reconciliation";
import { resolveMomoStore } from "@/lib/momo-store";

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

    const days = Math.min(90, Number(request.nextUrl.searchParams.get("days") || 30));
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data: rows, error } = await auth.serviceSupabase
      .from("billing_payments")
      .select("amount, status, payload, created_at, updated_at")
      .eq("store_id", storeResolved.storeId)
      .eq("method", "momo_link")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const payments = (rows ?? []).map((row) => {
      const pl = (row.payload ?? {}) as {
        label?: string;
        momo_reference?: string;
        sale_id?: string;
        confirmed_at?: string;
      };
      return {
        reference: pl.momo_reference ?? "",
        label: pl.label ?? "Paiement",
        amount: Number(row.amount),
        status: row.status,
        sale_id: pl.sale_id ?? null,
        paid_at:
          row.status === "succeeded"
            ? pl.confirmed_at ?? row.updated_at ?? row.created_at
            : null,
      };
    });

    const report = buildReconciliationReport(storeResolved.storeName, payments);

    return NextResponse.json({ success: true, report });
  } catch {
    return NextResponse.json({ success: false, error: "Erreur réconciliation." }, { status: 500 });
  }
}
