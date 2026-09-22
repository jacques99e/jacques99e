import { NextRequest, NextResponse } from "next/server";
import { checkStoreAccess, requireAuthContext } from "@/lib/api-auth";
import { isCloudUuid } from "@/lib/cloud-uuid";
import { createServiceSupabase } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthContext();
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const body = (await request.json()) as {
      store_id?: string;
      id?: string;
      full_name?: string;
      age?: number | null;
      blood_group?: string | null;
      allergies?: string | null;
      medical_history?: string | null;
      phone?: string | null;
    };

    const storeId = body.store_id?.trim();
    if (!storeId) {
      return NextResponse.json({ success: false, error: "Boutique introuvable." }, { status: 400 });
    }

    const access = await checkStoreAccess(auth.serviceSupabase, auth.userId, storeId, "write");
    if (!access.ok) {
      return NextResponse.json({ success: false, error: access.error }, { status: access.status });
    }

    const full_name = body.full_name?.trim();
    if (!full_name) {
      return NextResponse.json({ success: false, error: "Nom du patient requis." }, { status: 400 });
    }

    const clip = (value: string | null | undefined, max: number) =>
      value?.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max) || null;

    const row = {
      store_id: storeId,
      full_name: full_name.slice(0, 120),
      age: body.age ?? null,
      blood_group: clip(body.blood_group, 8),
      allergies: clip(body.allergies, 500),
      medical_history: clip(body.medical_history, 2000),
      phone: clip(body.phone, 20),
    };

    const service = await createServiceSupabase();
    const hasServerId = Boolean(body.id && isCloudUuid(body.id));
    const query = hasServerId
      ? service
          .from("health_patients")
          .update(row)
          .eq("id", body.id!)
          .eq("store_id", storeId)
          .select()
          .single()
      : service.from("health_patients").insert(row).select().single();

    const { data, error } = await query;
    if (error || !data) {
      return NextResponse.json(
        { success: false, error: error?.message || "Enregistrement impossible." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, patient: data });
  } catch {
    return NextResponse.json(
      { success: false, error: "Impossible d'enregistrer le patient." },
      { status: 500 }
    );
  }
}
