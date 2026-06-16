import { NextRequest, NextResponse } from "next/server";
import { checkStoreAccess, requireAuthContext } from "@/lib/api-auth";
import { anchorHashOnCelo, getCeloEnvironmentLabel, getCeloMode, isCeloConfigured } from "@/lib/celo";
import { buildAssetHash, sha256 } from "@/lib/crypto";
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
  const { data, error } = await service
    .from("blockchain_assets")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Impossible de recuperer les actifs blockchain." }, { status: 500 });
  return NextResponse.json({
    assets: data,
    celo_mode: getCeloMode(),
    celo_environment: getCeloEnvironmentLabel(),
    celo_ready: isCeloConfigured(),
  });
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

  const payload = {
    name,
    asset_type,
    description,
    store_id,
    recorded_at: new Date().toISOString(),
    ...(metadata && typeof metadata === "object" ? metadata : {}),
  };
  const hash_sha256 = await buildAssetHash(payload as Record<string, unknown>);

  const service = await createServiceSupabase();
  const { data, error } = await service
    .from("blockchain_assets")
    .insert({ store_id, name, asset_type, description, metadata, hash_sha256, latitude, longitude })
    .select()
    .single();
  if (error || !data) {
    return NextResponse.json({ error: "Impossible de creer l'actif blockchain." }, { status: 500 });
  }

  const { data: lastLedger } = await service
    .from("blockchain_ledger")
    .select("hash_sha256")
    .eq("store_id", store_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const prev = lastLedger?.hash_sha256 ?? "";
  const entryHash = await sha256(prev + hash_sha256 + "CREATE");
  await service.from("blockchain_ledger").insert({
    store_id,
    asset_id: data.id,
    action: "CREATE",
    hash_sha256: entryHash,
    prev_hash: prev || null,
    payload,
    latitude,
    longitude,
  });

  let asset = data;
  let celoWarning: string | undefined;

  try {
    const celoAnchor = await anchorHashOnCelo(hash_sha256);
    if (celoAnchor) {
      const { data: updated, error: celoUpdateError } = await service
        .from("blockchain_assets")
        .update({
          celo_tx_hash: celoAnchor.txHash,
          celo_network: celoAnchor.network,
          celo_block_number: celoAnchor.blockNumber,
          celo_anchored_at: new Date().toISOString(),
        })
        .eq("id", data.id)
        .select()
        .single();
      if (!celoUpdateError && updated) asset = updated;
    }
  } catch (celoErr) {
    celoWarning =
      celoErr instanceof Error
        ? `Actif enregistre localement. Ancrage Celo echoue: ${celoErr.message}`
        : "Actif enregistre localement. Ancrage Celo echoue.";
  }

  return NextResponse.json({
    asset,
    celo_mode: getCeloMode(),
    celo_environment: getCeloEnvironmentLabel(),
    warning: celoWarning,
  });
}
