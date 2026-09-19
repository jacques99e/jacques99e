import type { SupabaseClient } from "@supabase/supabase-js";
import { sendWeeklyReportEmail } from "@/lib/email";
import {
  buildEvolutionEmail,
  buildEvolutionNotices,
  isoWeekKey,
  loadEvolutionSnapshot,
  type EvolutionNotice,
} from "@/lib/evolution";
import { notifyStoreSubscribers } from "@/lib/push-server";

const SKIP_EMAIL_SLUGS = new Set(["hbk-boutyk-237"]);

export interface StoreNotificationRow {
  id: string;
  store_id: string;
  kind: string;
  title: string;
  body: string;
  href: string | null;
  read_at: string | null;
  created_at: string;
}

export async function resolveStoreEmail(
  db: SupabaseClient,
  storeId: string,
  ownerId: string | null
): Promise<{ email: string; person: string } | null> {
  const { data: settings } = await db
    .from("store_report_settings")
    .select("email")
    .eq("store_id", storeId)
    .maybeSingle();
  let email = String(settings?.email || "").trim();
  let person = "";

  if (ownerId) {
    const { data: userData } = await db.auth.admin.getUserById(ownerId);
    if (!email) email = userData.user?.email?.trim() || "";
    person = String(userData.user?.user_metadata?.full_name || "").trim();
  }
  if (!email) return null;
  return { email, person: person || "vous" };
}

export async function upsertEvolutionNotices(
  db: SupabaseClient,
  storeId: string,
  notices: EvolutionNotice[]
): Promise<{ inserted: EvolutionNotice[]; rows: number }> {
  const inserted: EvolutionNotice[] = [];

  for (const notice of notices) {
    const { data: existing } = await db
      .from("store_notifications")
      .select("id")
      .eq("store_id", storeId)
      .eq("dedup_key", notice.dedup_key)
      .maybeSingle();
    if (existing?.id) continue;

    const { error } = await db.from("store_notifications").insert({
      store_id: storeId,
      kind: notice.kind,
      dedup_key: notice.dedup_key,
      title: notice.title,
      body: notice.body,
      href: notice.href,
    });
    if (!error) inserted.push(notice);
  }

  return { inserted, rows: notices.length };
}

export async function refreshStoreEvolution(
  db: SupabaseClient,
  storeId: string,
  options?: { email?: boolean; push?: boolean }
): Promise<{ created: number; emailed: boolean }> {
  const snap = await loadEvolutionSnapshot(db, storeId);
  if (!snap) return { created: 0, emailed: false };
  if (snap.billingStatus === "expired") return { created: 0, emailed: false };

  const notices = buildEvolutionNotices(snap);
  const { inserted } = await upsertEvolutionNotices(db, storeId, notices);

  let emailed = false;
  const skipEmail = Boolean(snap.slug && SKIP_EMAIL_SLUGS.has(snap.slug));
  const weekKey = `weekly:${isoWeekKey()}`;
  const { data: weeklyRow } = await db
    .from("store_notifications")
    .select("dedup_key, title, body, emailed_at")
    .eq("store_id", storeId)
    .eq("dedup_key", weekKey)
    .maybeSingle();

  const pendingEmail = [
    ...inserted.filter((n) => n.emailIfFresh),
    ...(options?.email && weeklyRow && !weeklyRow.emailed_at
      ? [
          {
            kind: "weekly" as const,
            dedup_key: weekKey,
            title: String(weeklyRow.title),
            body: String(weeklyRow.body),
            href: "/notifications",
            emailIfFresh: true,
          },
        ]
      : []),
  ];
  const uniquePending = pendingEmail.filter(
    (notice, index, all) => all.findIndex((n) => n.dedup_key === notice.dedup_key) === index
  );

  const shouldEmail = Boolean(options?.email && uniquePending.length && !skipEmail);

  if (shouldEmail) {
    const dest = await resolveStoreEmail(db, storeId, snap.ownerId);
    if (dest) {
      const payload = buildEvolutionEmail({
        storeName: snap.storeName,
        person: dest.person,
        notices: uniquePending,
      });
      const sent = await sendWeeklyReportEmail({
        to: dest.email,
        storeName: snap.storeName,
        ...payload,
      });
      if (sent.ok) {
        emailed = true;
        const keys = uniquePending.map((n) => n.dedup_key);
        await db
          .from("store_notifications")
          .update({ emailed_at: new Date().toISOString() })
          .eq("store_id", storeId)
          .in("dedup_key", keys);
      }
    }
  }

  if (options?.push && inserted[0]) {
    await notifyStoreSubscribers(db, storeId, {
      title: inserted[0].title,
      body: inserted[0].body,
      url: "/notifications",
    });
  }

  return { created: inserted.length, emailed };
}

export async function runDailyEvolutionDigest(
  db: SupabaseClient
): Promise<{ stores: number; created: number; emailed: number }> {
  const { data: subs } = await db
    .from("billing_subscriptions")
    .select("store_id, status")
    .in("status", ["trial", "active"])
    .limit(50);

  let created = 0;
  let emailed = 0;
  const isMonday = new Date().getUTCDay() === 1;

  for (const row of subs || []) {
    try {
      const result = await refreshStoreEvolution(db, row.store_id as string, {
        email: isMonday,
        push: isMonday,
      });
      created += result.created;
      if (result.emailed) emailed += 1;
    } catch (error) {
      console.error(
        "[evolution]",
        row.store_id,
        error instanceof Error ? error.message : error
      );
    }
  }

  return { stores: subs?.length ?? 0, created, emailed };
}

export async function listStoreNotifications(
  db: SupabaseClient,
  storeId: string,
  unreadOnly = false
): Promise<StoreNotificationRow[]> {
  let query = db
    .from("store_notifications")
    .select("id, store_id, kind, title, body, href, read_at, created_at")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(40);
  if (unreadOnly) query = query.is("read_at", null);
  const { data } = await query;
  return (data || []) as StoreNotificationRow[];
}

export async function markNotificationsRead(
  db: SupabaseClient,
  storeId: string,
  ids?: string[]
): Promise<void> {
  let query = db
    .from("store_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("store_id", storeId)
    .is("read_at", null);
  if (ids?.length) query = query.in("id", ids);
  await query;
}
