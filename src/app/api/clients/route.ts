import { NextRequest, NextResponse } from "next/server";
import { checkStoreAccess, requireAuthContext } from "@/lib/api-auth";
import { createServiceSupabase } from "@/lib/supabase/server";

/** GET /api/clients?storeId= — liste CRM (service role, après contrôle d'accès). */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthContext();
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const storeId =
      request.nextUrl.searchParams.get("storeId")?.trim() ||
      request.nextUrl.searchParams.get("store_id")?.trim();
    if (!storeId) {
      return NextResponse.json({ success: false, error: "storeId requis." }, { status: 400 });
    }

    const access = await checkStoreAccess(auth.serviceSupabase, auth.userId, storeId, "read");
    if (!access.ok) {
      return NextResponse.json({ success: false, error: access.error }, { status: access.status });
    }

    const service = await createServiceSupabase();
    const { data, error } = await service
      .from("crm_clients")
      .select("*")
      .eq("store_id", storeId)
      .order("updated_at", { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, clients: data || [] });
  } catch {
    return NextResponse.json(
      { success: false, error: "Impossible de charger les clients." },
      { status: 500 }
    );
  }
}

function sequenceStep(value: unknown): 1 | 2 | null {
  if (value === 1 || value === "1") return 1;
  if (value === 2 || value === "2") return 2;
  return null;
}

function isoDate(value: unknown): string | null {
  const day = String(value ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

/** POST /api/clients — upsert client CRM. */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthContext();
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const body = (await request.json()) as {
      store_id?: string;
      id?: string;
      external_local_id?: string;
      name?: string;
      phone?: string | null;
      tags?: string[];
      status?: string;
      next_follow_up?: string | null;
      note?: string | null;
      sequence_step?: number | string | null;
      sequence_started_at?: string | null;
      last_relance_at?: string | null;
    };

    const storeId = body.store_id?.trim();
    const name = body.name?.trim();
    const externalLocalId = body.external_local_id?.trim();
    if (!storeId || !name || !externalLocalId) {
      return NextResponse.json(
        { success: false, error: "store_id, name et external_local_id requis." },
        { status: 400 }
      );
    }

    const access = await checkStoreAccess(auth.serviceSupabase, auth.userId, storeId, "write");
    if (!access.ok) {
      return NextResponse.json({ success: false, error: access.error }, { status: access.status });
    }

    const service = await createServiceSupabase();
    const row = {
      store_id: storeId,
      external_local_id: externalLocalId,
      name,
      phone: body.phone || null,
      tags: Array.isArray(body.tags) ? body.tags : [],
      status: body.status || "prospect",
      next_follow_up: isoDate(body.next_follow_up),
      note: body.note || null,
      sequence_step: sequenceStep(body.sequence_step),
      sequence_started_at: isoDate(body.sequence_started_at),
      last_relance_at: isoDate(body.last_relance_at),
      updated_at: new Date().toISOString(),
    };

    // Index unique partiel (store_id, external_local_id) — PostgREST
    // onConflict ne l'infère pas. Lookup puis update/insert.
    const existingId = body.id?.trim() || null;
    if (existingId) {
      const { data, error } = await service
        .from("crm_clients")
        .update(row)
        .eq("id", existingId)
        .eq("store_id", storeId)
        .select("id")
        .maybeSingle();
      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
      if (data?.id) {
        return NextResponse.json({ success: true, id: data.id });
      }
    }

    const { data: existing, error: lookupError } = await service
      .from("crm_clients")
      .select("id")
      .eq("store_id", storeId)
      .eq("external_local_id", externalLocalId)
      .maybeSingle();
    if (lookupError) {
      return NextResponse.json({ success: false, error: lookupError.message }, { status: 500 });
    }

    if (existing?.id) {
      const { data, error } = await service
        .from("crm_clients")
        .update(row)
        .eq("id", existing.id)
        .eq("store_id", storeId)
        .select("id")
        .maybeSingle();
      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, id: data?.id || existing.id });
    }

    const { data, error } = await service
      .from("crm_clients")
      .insert(row)
      .select("id")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data?.id });
  } catch {
    return NextResponse.json(
      { success: false, error: "Impossible d'enregistrer le client." },
      { status: 500 }
    );
  }
}
