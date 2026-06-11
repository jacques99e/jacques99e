import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ hash: string }> }
) {
  const { hash } = await context.params;
  const prefix = decodeURIComponent(hash).trim().toLowerCase();
  if (!prefix || prefix.length < 8) {
    return NextResponse.json({ success: false, error: "Hash invalide" }, { status: 400 });
  }

  try {
    const supabase = await createServiceSupabase();
    const { data: rows, error } = await supabase
      .from("blockchain_assets")
      .select("name, asset_type, hash_sha256, description, created_at")
      .ilike("hash_sha256", `${prefix}%`)
      .limit(1);

    if (error || !rows?.length) {
      return NextResponse.json({ success: false, error: "Actif non trouvé" }, { status: 404 });
    }

    const asset = rows[0];
    return NextResponse.json({
      success: true,
      asset: {
        name: asset.name,
        asset_type: asset.asset_type,
        hash_sha256: asset.hash_sha256,
        description: asset.description,
        recorded_at: asset.created_at,
        verified: Boolean(asset.hash_sha256 && String(asset.hash_sha256).length >= 32),
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur serveur";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
