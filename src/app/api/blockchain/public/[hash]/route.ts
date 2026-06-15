import { NextResponse } from "next/server";
import { celoExplorerTxUrl, verifyHashOnCelo } from "@/lib/celo";
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
      .select(
        "name, asset_type, hash_sha256, description, created_at, celo_tx_hash, celo_network, celo_block_number, celo_anchored_at"
      )
      .ilike("hash_sha256", `${prefix}%`)
      .limit(1);

    if (error || !rows?.length) {
      return NextResponse.json({ success: false, error: "Actif non trouvé" }, { status: 404 });
    }

    const asset = rows[0];
    const hashValid = Boolean(asset.hash_sha256 && String(asset.hash_sha256).length >= 32);
    let celoVerified = false;
    if (asset.celo_tx_hash && asset.celo_network) {
      try {
        celoVerified = await verifyHashOnCelo(
          asset.celo_network,
          asset.celo_tx_hash,
          asset.hash_sha256
        );
      } catch {
        celoVerified = false;
      }
    }

    return NextResponse.json({
      success: true,
      asset: {
        name: asset.name,
        asset_type: asset.asset_type,
        hash_sha256: asset.hash_sha256,
        description: asset.description,
        recorded_at: asset.created_at,
        verified: hashValid,
        celo_tx_hash: asset.celo_tx_hash,
        celo_network: asset.celo_network,
        celo_block_number: asset.celo_block_number,
        celo_anchored_at: asset.celo_anchored_at,
        celo_verified: celoVerified,
        celo_explorer_url: asset.celo_tx_hash
          ? celoExplorerTxUrl(asset.celo_network || "alfajores", asset.celo_tx_hash)
          : null,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur serveur";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
