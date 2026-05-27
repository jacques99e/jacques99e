import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/server";
import { sha256 } from "@/lib/crypto";

export async function GET(request: NextRequest) {
  const storeId = request.nextUrl.searchParams.get("store_id");
  if (!storeId) return NextResponse.json({ error: "store_id required" }, { status: 400 });
  const supabase = await createServiceSupabase();
  const { data, error } = await supabase
    .from("blockchain_assets")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ assets: data });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { store_id, name, asset_type, description, metadata, latitude, longitude } = body;
  if (!store_id || !name) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const hash_sha256 = await sha256(
    JSON.stringify({ store_id, name, asset_type, description, metadata, t: Date.now() })
  );
  const supabase = await createServiceSupabase();
  const { data, error } = await supabase
    .from("blockchain_assets")
    .insert({ store_id, name, asset_type, description, metadata, hash_sha256, latitude, longitude })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ asset: data });
}
