import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/server";

function trackingCode() {
  return `WZ${Date.now().toString(36).toUpperCase()}`;
}

export async function GET(request: NextRequest) {
  const storeId = request.nextUrl.searchParams.get("store_id");
  if (!storeId) return NextResponse.json({ error: "store_id required" }, { status: 400 });
  const supabase = await createServiceSupabase();
  const { data, error } = await supabase
    .from("deliveries")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deliveries: data });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const supabase = await createServiceSupabase();
  const { data, error } = await supabase
    .from("deliveries")
    .insert({ ...body, tracking_code: trackingCode(), status: "pending" })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ delivery: data });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { id, status, signature_data } = body;
  if (!id || !status) return NextResponse.json({ error: "id and status required" }, { status: 400 });
  const supabase = await createServiceSupabase();
  const { data, error } = await supabase
    .from("deliveries")
    .update({ status, signature_data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ delivery: data });
}
