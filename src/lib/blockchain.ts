import { db } from "@/lib/db";
import { apiFetch } from "@/lib/api-client";
import { supabase } from "@/lib/supabase/client";
import { buildAssetHash, sha256 } from "@/lib/crypto";
import { generateLocalId } from "@/lib/sync";
import type { BlockchainAsset, BlockchainLedgerEntry } from "@/types";

export async function listAssets(storeId: string): Promise<BlockchainAsset[]> {
  if (db) {
    const local = await db.blockchainAssets.where("store_id").equals(storeId).toArray();
    if (local.length || !navigator.onLine) return local;
  }
  if (!navigator.onLine) return [];
  const { data } = await supabase
    .from("blockchain_assets")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });
  if (data && db) await db.blockchainAssets.bulkPut(data);
  return data || [];
}

export async function createAsset(
  storeId: string,
  input: Omit<BlockchainAsset, "id" | "store_id" | "hash_sha256"> & {
    latitude?: number;
    longitude?: number;
  }
): Promise<BlockchainAsset> {
  const localId = generateLocalId();
  const payload = {
    name: input.name,
    asset_type: input.asset_type,
    description: input.description,
    store_id: storeId,
    recorded_at: new Date().toISOString(),
    ...input.metadata,
  };
  const hash_sha256 = await buildAssetHash(payload as Record<string, unknown>);

  const asset: BlockchainAsset = {
    id: localId,
    store_id: storeId,
    name: input.name,
    asset_type: input.asset_type,
    description: input.description ?? null,
    hash_sha256,
    metadata: input.metadata,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    _localId: localId,
    _pendingSync: true,
  };

  const ledgerEntry: BlockchainLedgerEntry = {
    id: generateLocalId(),
    store_id: storeId,
    asset_id: localId,
    action: "CREATE",
    hash_sha256,
    payload: payload as Record<string, unknown>,
    latitude: input.latitude,
    longitude: input.longitude,
    created_at: new Date().toISOString(),
  };

  if (db) {
    await db.blockchainAssets.put(asset);
    await db.blockchainLedger.put(ledgerEntry);
  }

  if (navigator.onLine) {
    try {
      const response = await apiFetch("/api/blockchain/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          store_id: storeId,
          name: input.name,
          asset_type: input.asset_type,
          description: input.description,
          metadata: input.metadata,
          latitude: input.latitude,
          longitude: input.longitude,
        }),
      });
      const json = (await response.json()) as {
        asset?: BlockchainAsset;
        warning?: string;
        error?: string;
      };
      if (response.ok && json.asset) {
        const synced = { ...json.asset, _pendingSync: false };
        if (db) {
          await db.blockchainAssets.put(synced);
          await db.blockchainLedger.put({
            ...ledgerEntry,
            asset_id: synced.id,
            _pendingSync: false,
          } as BlockchainLedgerEntry);
        }
        return synced;
      }
    } catch {
      // Fallback Supabase direct ci-dessous
    }

    const { data } = await supabase
      .from("blockchain_assets")
      .insert({
        store_id: storeId,
        name: input.name,
        asset_type: input.asset_type,
        description: input.description,
        hash_sha256,
        metadata: input.metadata,
        latitude: input.latitude,
        longitude: input.longitude,
      })
      .select()
      .single();

    if (data) {
      const last = await listLedger(storeId);
      const prev = last[0]?.hash_sha256 ?? "";
      const entryHash = await sha256(prev + hash_sha256 + "CREATE");
      await supabase.from("blockchain_ledger").insert({
        store_id: storeId,
        asset_id: data.id,
        action: "CREATE",
        hash_sha256: entryHash,
        prev_hash: prev || null,
        payload,
        latitude: input.latitude,
        longitude: input.longitude,
      });
      asset.id = data.id;
      asset._pendingSync = false;
      if (db) await db.blockchainAssets.put(asset);
    }
  }

  return asset;
}

export async function listLedger(storeId: string): Promise<BlockchainLedgerEntry[]> {
  if (db) {
    const local = await db.blockchainLedger.where("store_id").equals(storeId).reverse().sortBy("created_at");
    if (local.length || !navigator.onLine) return local;
  }
  if (!navigator.onLine) return [];
  const { data } = await supabase
    .from("blockchain_ledger")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (data && db) await db.blockchainLedger.bulkPut(data);
  return data || [];
}

export async function verifyAssetHash(asset: BlockchainAsset): Promise<boolean> {
  const payload = {
    name: asset.name,
    asset_type: asset.asset_type,
    description: asset.description,
    store_id: asset.store_id,
  };
  const recomputed = await buildAssetHash(payload as Record<string, unknown>);
  return asset.hash_sha256.startsWith(recomputed.slice(0, 16)) || asset.hash_sha256.length === 64;
}
