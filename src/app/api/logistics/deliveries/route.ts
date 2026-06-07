import { NextRequest, NextResponse } from "next/server";
import { checkStoreAccess, requireAuthContext } from "@/lib/api-auth";

function trackingCode() {
  return `WZ${Date.now().toString(36).toUpperCase()}`;
}

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

  const { data, error } = await auth.serviceSupabase
    .from("deliveries")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Impossible de recuperer les livraisons." }, { status: 500 });
  return NextResponse.json({ deliveries: data });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const storeId = typeof body.store_id === "string" ? body.store_id : null;
  if (!storeId) return NextResponse.json({ error: "Identifiant boutique requis." }, { status: 400 });

  const auth = await requireAuthContext();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const access = await checkStoreAccess(auth.serviceSupabase, auth.userId, storeId, "write");
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { data, error } = await auth.serviceSupabase
    .from("deliveries")
    .insert({ ...body, tracking_code: trackingCode(), status: "pending" })
    .select()
    .single();
  if (error) return NextResponse.json({ error: "Impossible de creer la livraison." }, { status: 500 });
  return NextResponse.json({ delivery: data });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { id, status, signature_data } = body;
  if (!id || !status) {
    return NextResponse.json({ error: "Identifiant livraison et statut requis." }, { status: 400 });
  }
  const auth = await requireAuthContext();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data: delivery, error: deliveryError } = await auth.serviceSupabase
    .from("deliveries")
    .select("store_id")
    .eq("id", id)
    .single();
  if (deliveryError) return NextResponse.json({ error: "Impossible de verifier la livraison." }, { status: 500 });
  if (!delivery?.store_id) return NextResponse.json({ error: "Livraison introuvable." }, { status: 404 });

  const access = await checkStoreAccess(
    auth.serviceSupabase,
    auth.userId,
    delivery.store_id as string,
    "write"
  );
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { data, error } = await auth.serviceSupabase
    .from("deliveries")
    .update({ status, signature_data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: "Impossible de mettre a jour la livraison." }, { status: 500 });
  return NextResponse.json({ delivery: data });
}
