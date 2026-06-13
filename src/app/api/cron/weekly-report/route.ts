import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendWeeklyReportEmail } from "@/lib/email";
import { buildWeeklyReportEmailContent } from "@/lib/report-email-content";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { success: false, error: "Supabase service role not configured" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const now = new Date();
  const weekday = now.getUTCDay();
  const hourUtc = now.getUTCHours();

  const weekStart = new Date(now);
  weekStart.setUTCDate(now.getUTCDate() - 7);
  weekStart.setUTCHours(0, 0, 0, 0);

  const { data: settings, error } = await supabase
    .from("store_report_settings")
    .select("store_id, email, enabled, weekday, hour_utc, stores(name)")
    .eq("enabled", true);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const results: Array<{ store_id: string; ok: boolean; detail: string }> = [];

  for (const row of settings || []) {
    if (row.weekday !== weekday || row.hour_utc !== hourUtc) {
      continue;
    }

    const storeId = row.store_id as string;
    const storeName =
      (row.stores as { name?: string } | null)?.name || "Boutique Wazo";

    const { data: sales } = await supabase
      .from("sales")
      .select("total_amount, total, created_at")
      .eq("store_id", storeId)
      .gte("created_at", weekStart.toISOString());

    const revenue = (sales || []).reduce(
      (sum, s) => sum + Number(s.total_amount ?? s.total ?? 0),
      0
    );
    const salesCount = sales?.length ?? 0;
    const avgBasket = salesCount > 0 ? revenue / salesCount : 0;

    const { data: products } = await supabase
      .from("products")
      .select("stock_quantity")
      .eq("store_id", storeId);

    const outOfStock = (products || []).filter((p) => Number(p.stock_quantity) <= 0).length;
    const lowStock = (products || []).filter(
      (p) => Number(p.stock_quantity) > 0 && Number(p.stock_quantity) <= 5
    ).length;

    const { subject, html, text } = buildWeeklyReportEmailContent({
      storeName,
      periodLabel: `7 derniers jours (jusqu'au ${now.toLocaleDateString("fr-FR")})`,
      salesCount,
      revenue,
      avgBasket,
      outOfStock,
      lowStock,
      lines: [`Consultez le détail sur https://app.wazo-digital.com/insights`],
    });

    const sent = await sendWeeklyReportEmail({
      to: row.email as string,
      storeName,
      subject,
      html,
      text,
    });

    if (sent.ok) {
      await supabase
        .from("store_report_settings")
        .update({ last_sent_at: now.toISOString() })
        .eq("store_id", storeId);
    }

    results.push({
      store_id: storeId,
      ok: sent.ok,
      detail: sent.ok ? "sent" : sent.error || "failed",
    });
  }

  return NextResponse.json({
    success: true,
    processed: results.length,
    results,
    note:
      results.length === 0
        ? "No stores matched current weekday/hour (UTC). Cron runs weekly; settings use weekday + hour_utc."
        : undefined,
  });
}
