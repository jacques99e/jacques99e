import { NextResponse } from "next/server";
import { checkStoreAccess, requireAuthContext } from "@/lib/api-auth";
import { assertStoreBillingFeature } from "@/lib/plan-access";
import { sendWeeklyReportEmail } from "@/lib/email";
import { buildWeeklyReportEmailContent } from "@/lib/report-email-content";

export async function POST(request: Request) {
  const auth = await requireAuthContext();
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const body = (await request.json()) as { store_id?: string; email?: string };
  if (!body.store_id) {
    return NextResponse.json({ success: false, error: "store_id requis" }, { status: 400 });
  }

  const access = await checkStoreAccess(
    auth.serviceSupabase,
    auth.userId,
    body.store_id,
    "write"
  );
  if (!access.ok) {
    return NextResponse.json({ success: false, error: access.error }, { status: access.status });
  }

  const planCheck = await assertStoreBillingFeature(
    auth.serviceSupabase,
    body.store_id,
    "weekly_email"
  );
  if (!planCheck.ok) {
    return NextResponse.json({ success: false, error: planCheck.error }, { status: 403 });
  }

  const { data: settings } = await auth.serviceSupabase
    .from("store_report_settings")
    .select("email")
    .eq("store_id", body.store_id)
    .maybeSingle();

  const to = body.email?.trim() || (settings?.email as string | undefined);
  if (!to) {
    return NextResponse.json(
      { success: false, error: "Enregistrez d'abord une adresse e-mail." },
      { status: 400 }
    );
  }

  const { data: store } = await auth.serviceSupabase
    .from("stores")
    .select("name")
    .eq("id", body.store_id)
    .maybeSingle();

  const storeName = store?.name || "Boutique Wazo";
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setUTCDate(now.getUTCDate() - 7);
  weekStart.setUTCHours(0, 0, 0, 0);

  const { data: sales } = await auth.serviceSupabase
    .from("sales")
    .select("total_amount, total, created_at")
    .eq("store_id", body.store_id)
    .gte("created_at", weekStart.toISOString());

  const revenue = (sales || []).reduce(
    (sum, s) => sum + Number(s.total_amount ?? s.total ?? 0),
    0
  );
  const salesCount = sales?.length ?? 0;
  const avgBasket = salesCount > 0 ? revenue / salesCount : 0;

  const { data: products } = await auth.serviceSupabase
    .from("products")
    .select("stock_quantity")
    .eq("store_id", body.store_id);

  const outOfStock = (products || []).filter((p) => Number(p.stock_quantity) <= 0).length;
  const lowStock = (products || []).filter(
    (p) => Number(p.stock_quantity) > 0 && Number(p.stock_quantity) <= 5
  ).length;

  const { subject, html, text } = buildWeeklyReportEmailContent({
    storeName,
    periodLabel: `Test — 7 derniers jours (au ${now.toLocaleDateString("fr-FR")})`,
    salesCount,
    revenue,
    avgBasket,
    outOfStock,
    lowStock,
    lines: [
      "Ceci est un envoi de test depuis Paramètres → Notifications.",
      "Le rapport automatique part chaque lundi à 8h UTC si activé.",
    ],
  });

  const sent = await sendWeeklyReportEmail({
    to,
    storeName,
    subject: `[TEST] ${subject}`,
    html,
    text,
  });

  if (!sent.ok) {
    return NextResponse.json(
      { success: false, error: sent.error || "Échec d'envoi" },
      { status: 502 }
    );
  }

  return NextResponse.json({ success: true, email: to });
}
