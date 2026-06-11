import { NextRequest, NextResponse } from "next/server";
import { checkStoreAccess, getAdminSupabase, requireAuthContext } from "@/lib/api-auth";
import { sha256 } from "@/lib/crypto";

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

  const admin = await getAdminSupabase();
  const { data, error } = await admin
    .from("blockchain_assets")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Impossible de recuperer les actifs blockchain." }, { status: 500 });
  return NextResponse.json({ assets: data });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { store_id, name, asset_type, description, metadata, latitude, longitude } = body;
  if (!store_id || !name) {
    return NextResponse.json({ error: "Donnees invalides pour creer un actif." }, { status: 400 });
  }
  const auth = await requireAuthContext();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const access = await checkStoreAccess(auth.serviceSupabase, auth.userId, store_id, "write");
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const hash_sha256 = await sha256(
    JSON.stringify({ store_id, name, asset_type, description, metadata, t: Date.now() })
  );
  const admin = await getAdminSupabase();
  const { data, error } = await admin
    .from("blockchain_assets")
    .insert({ store_id, name, asset_type, description, metadata, hash_sha256, latitude, longitude })
    .select()
    .single();
  if (error) return NextResponse.json({ error: "Impossible de creer l'actif blockchain." }, { status: 500 });
  return NextResponse.json({ asset: data });
}
