import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isPushConfigured, sendWebPush } from "@/lib/push-server";

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

  if (!isPushConfigured()) {
    return NextResponse.json(
      { success: false, error: "VAPID keys not configured" },
      { status: 503 }
    );
  }

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { success: false, error: "Supabase service role not configured" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const today = new Date().toISOString().slice(0, 10);

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("user_id, store_id, endpoint, p256dh, auth");

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const byStore = new Map<string, typeof subs>();
  for (const sub of subs || []) {
    const list = byStore.get(sub.store_id) || [];
    list.push(sub);
    byStore.set(sub.store_id, list);
  }

  let sent = 0;
  const results: Array<{ store_id: string; ok: boolean; detail: string }> = [];

  for (const [storeId, storeSubs] of byStore) {
    const messages: Array<{ title: string; body: string; url: string }> = [];

    const { data: products } = await supabase
      .from("products")
      .select("stock_quantity")
      .eq("store_id", storeId);

    const outOfStock = (products || []).filter((p) => Number(p.stock_quantity) <= 0).length;
    const lowStock = (products || []).filter(
      (p) => Number(p.stock_quantity) > 0 && Number(p.stock_quantity) <= 5
    ).length;

    if (outOfStock + lowStock > 0) {
      messages.push({
        title: "Stock à surveiller",
        body:
          outOfStock > 0 && lowStock > 0
            ? `${outOfStock} rupture(s), ${lowStock} stock faible`
            : outOfStock > 0
              ? `${outOfStock} produit(s) en rupture`
              : `${lowStock} produit(s) sous le seuil`,
        url: "/products",
      });
    }

    const { data: clients } = await supabase
      .from("clients")
      .select("next_follow_up")
      .eq("store_id", storeId);

    let followToday = 0;
    let followOverdue = 0;
    for (const c of clients || []) {
      const d = c.next_follow_up as string | null;
      if (!d) continue;
      if (d === today) followToday += 1;
      else if (d < today) followOverdue += 1;
    }
    if (followToday + followOverdue > 0) {
      messages.push({
        title: "Relances clients",
        body: `${followToday} aujourd'hui · ${followOverdue} en retard`,
        url: "/clients",
      });
    }

    const dayStart = `${today}T00:00:00`;
    const dayEnd = `${today}T23:59:59`;
    const { data: appointments } = await supabase
      .from("health_appointments")
      .select("status, scheduled_at")
      .eq("store_id", storeId)
      .gte("scheduled_at", dayStart)
      .lte("scheduled_at", dayEnd);

    const apptToday = appointments?.length ?? 0;
    const apptPending =
      appointments?.filter((a) => a.status === "pending").length ?? 0;
    if (apptToday > 0) {
      messages.push({
        title: "Rappel rendez-vous",
        body:
          apptPending > 0
            ? `${apptToday} RDV aujourd'hui · ${apptPending} en attente`
            : `${apptToday} rendez-vous prévu(s) aujourd'hui`,
        url: "/health/appointments",
      });
    }

    if (messages.length === 0) {
      results.push({ store_id: storeId, ok: true, detail: "no_alerts" });
      continue;
    }

    const payload = messages[0];
    let storeSent = 0;
    for (const sub of storeSubs || []) {
      try {
        await sendWebPush(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          { title: payload.title, body: payload.body, url: payload.url }
        );
        storeSent += 1;
        sent += 1;
      } catch {
        // expired subscription
      }
    }
    results.push({
      store_id: storeId,
      ok: storeSent > 0,
      detail: storeSent > 0 ? `sent:${storeSent}` : "no_delivery",
    });
  }

  return NextResponse.json({
    success: true,
    stores: byStore.size,
    sent,
    results,
  });
}
