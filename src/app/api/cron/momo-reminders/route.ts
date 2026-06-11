import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isPushConfigured, sendWebPush } from "@/lib/push-server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ success: false, error: "Supabase non configuré" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: pending, error } = await supabase
    .from("billing_payments")
    .select("id, store_id, amount, payload, created_at")
    .eq("method", "momo_link")
    .eq("status", "pending")
    .lt("created_at", cutoff);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const byStore = new Map<string, { count: number; total: number }>();
  for (const row of pending ?? []) {
    const cur = byStore.get(row.store_id) ?? { count: 0, total: 0 };
    cur.count += 1;
    cur.total += Number(row.amount);
    byStore.set(row.store_id, cur);
  }

  let pushSent = 0;
  const results: Array<{ store_id: string; pending: number; push: boolean }> = [];

  if (isPushConfigured()) {
    for (const [storeId, stats] of byStore) {
      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth")
        .eq("store_id", storeId);

      let ok = false;
      for (const sub of subs ?? []) {
        try {
          await sendWebPush(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            {
              title: "Liens MoMo en attente",
              body: `${stats.count} lien(s) non payé(s) — ${stats.total.toLocaleString("fr-FR")} FCFA`,
              url: "/sales/liens",
            }
          );
          pushSent++;
          ok = true;
        } catch {
          /* expired subscription */
        }
      }
      results.push({ store_id: storeId, pending: stats.count, push: ok });
    }
  }

  return NextResponse.json({
    success: true,
    stores_notified: results.length,
    push_sent: pushSent,
    total_stale_pending: pending?.length ?? 0,
    results,
  });
}
