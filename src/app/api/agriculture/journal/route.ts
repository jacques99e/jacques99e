import { NextRequest, NextResponse } from "next/server";
import { checkStoreAccess, requireAuthContext } from "@/lib/api-auth";
import { isCloudUuid } from "@/lib/cloud-uuid";
import { allowUser } from "@/lib/rate-limit";
import { createServiceSupabase } from "@/lib/supabase/server";

const ENTRY_ID = /^[a-zA-Z0-9-]{8,80}$/;
const FIELD_DATE = /^\d{4}-\d{2}-\d{2}$/;

type JournalPayload = {
  client_id?: string;
  date?: string;
  parcel_label?: string;
  activity?: string;
  notes?: string;
};

function clip(value: unknown, max: number): string {
  return String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, max);
}

function toEntry(storeId: string, payload: JournalPayload) {
  const id = clip(payload.client_id, 80);
  if (!ENTRY_ID.test(id)) return null;
  return {
    id,
    store_id: storeId,
    date: FIELD_DATE.test(clip(payload.date, 10)) ? clip(payload.date, 10) : "",
    parcel_label: clip(payload.parcel_label, 80),
    activity: clip(payload.activity, 40),
    notes: clip(payload.notes, 500),
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireAuthContext();
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }
  if (!(await allowUser(auth.userId, "agri-journal", 120, 60 * 60 * 1000))) {
    return NextResponse.json({ success: false, error: "Trop de requêtes." }, { status: 429 });
  }
  const storeId = request.nextUrl.searchParams.get("storeId")?.trim() || "";
  if (!isCloudUuid(storeId)) {
    return NextResponse.json({ success: false, error: "Boutique invalide." }, { status: 400 });
  }
  const access = await checkStoreAccess(auth.serviceSupabase, auth.userId, storeId, "read");
  if (!access.ok) {
    return NextResponse.json({ success: false, error: access.error }, { status: access.status });
  }

  const service = await createServiceSupabase();
  const { data, error } = await service
    .from("farm_records")
    .select("payload, created_at")
    .eq("store_id", storeId)
    .eq("record_type", "journal")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const entries = (data || [])
    .map((row) => toEntry(storeId, (row.payload || {}) as JournalPayload))
    .filter((row): row is NonNullable<typeof row> => Boolean(row?.date && row.parcel_label))
    .sort((a, b) => b.date.localeCompare(a.date));

  return NextResponse.json({ success: true, entries });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthContext();
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }
  if (!(await allowUser(auth.userId, "agri-journal", 120, 60 * 60 * 1000))) {
    return NextResponse.json({ success: false, error: "Trop de requêtes." }, { status: 429 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    store_id?: string;
    id?: string;
    date?: string;
    parcel_label?: string;
    activity?: string;
    notes?: string;
  };
  const storeId = body.store_id?.trim() || "";
  const entry = toEntry(storeId, {
    client_id: body.id,
    date: body.date,
    parcel_label: body.parcel_label,
    activity: body.activity,
    notes: body.notes,
  });
  if (!isCloudUuid(storeId) || !entry?.date || !entry.parcel_label) {
    return NextResponse.json({ success: false, error: "Entrée invalide." }, { status: 400 });
  }
  const access = await checkStoreAccess(auth.serviceSupabase, auth.userId, storeId, "write");
  if (!access.ok) {
    return NextResponse.json({ success: false, error: access.error }, { status: access.status });
  }

  const service = await createServiceSupabase();
  const { data: existing } = await service
    .from("farm_records")
    .select("payload")
    .eq("store_id", storeId)
    .eq("record_type", "journal")
    .eq("payload->>client_id", entry.id)
    .maybeSingle();
  if (existing?.payload) {
    return NextResponse.json({ success: true, entry });
  }

  const { error } = await service.from("farm_records").insert({
    store_id: storeId,
    record_type: "journal",
    notes: `${entry.activity} — ${entry.parcel_label}`.slice(0, 180),
    payload: {
      client_id: entry.id,
      date: entry.date,
      parcel_label: entry.parcel_label,
      activity: entry.activity,
      notes: entry.notes,
    },
  });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, entry });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAuthContext();
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }
  if (!(await allowUser(auth.userId, "agri-journal", 120, 60 * 60 * 1000))) {
    return NextResponse.json({ success: false, error: "Trop de requêtes." }, { status: 429 });
  }
  const body = (await request.json().catch(() => ({}))) as { store_id?: string; id?: string };
  const storeId = body.store_id?.trim() || "";
  const id = clip(body.id, 80);
  if (!isCloudUuid(storeId) || !ENTRY_ID.test(id)) {
    return NextResponse.json({ success: false, error: "Entrée invalide." }, { status: 400 });
  }
  const access = await checkStoreAccess(auth.serviceSupabase, auth.userId, storeId, "write");
  if (!access.ok) {
    return NextResponse.json({ success: false, error: access.error }, { status: access.status });
  }

  const service = await createServiceSupabase();
  const { error } = await service
    .from("farm_records")
    .delete()
    .eq("store_id", storeId)
    .eq("record_type", "journal")
    .eq("payload->>client_id", id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
