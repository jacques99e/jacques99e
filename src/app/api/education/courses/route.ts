import { NextRequest, NextResponse } from "next/server";
import { checkStoreAccess, requireAuthContext } from "@/lib/api-auth";
import { createServiceSupabase } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const storeId = request.nextUrl.searchParams.get("store_id");
  if (!storeId) return NextResponse.json({ error: "Identifiant boutique requis." }, { status: 400 });
  const auth = await requireAuthContext();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const access = await checkStoreAccess(auth.serviceSupabase, auth.userId, storeId, "read");
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const service = await createServiceSupabase();
  const { data, error } = await service.from("courses").select("*").eq("store_id", storeId);
  if (error) return NextResponse.json({ error: "Impossible de recuperer les cours." }, { status: 500 });
  return NextResponse.json({ courses: data });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const storeId = typeof body.store_id === "string" ? body.store_id : null;
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description : null;
  const isPublic = body.is_public === true;

  if (!storeId || !title) {
    return NextResponse.json({ error: "Identifiant boutique et titre requis." }, { status: 400 });
  }

  const auth = await requireAuthContext();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const access = await checkStoreAccess(auth.serviceSupabase, auth.userId, storeId, "write");
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const service = await createServiceSupabase();
  const { data, error } = await service
    .from("courses")
    .insert({
      store_id: storeId,
      title,
      description,
      is_public: isPublic,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message || "Impossible de creer le cours." }, { status: 500 });
  return NextResponse.json({ course: data });
}
