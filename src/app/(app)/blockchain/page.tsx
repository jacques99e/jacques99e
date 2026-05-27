"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Shield } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/contexts/I18nContext";
import { localStore } from "@/lib/db";
import { listAssets, listLedger } from "@/lib/blockchain";
import type { BlockchainAsset, BlockchainLedgerEntry } from "@/types";

export default function BlockchainPage() {
  const { t } = useI18n();
  const store = localStore.get();
  const [assets, setAssets] = useState<BlockchainAsset[]>([]);
  const [ledger, setLedger] = useState<BlockchainLedgerEntry[]>([]);

  useEffect(() => {
    if (!store) return;
    listAssets(store.id).then(setAssets);
    listLedger(store.id).then(setLedger);
  }, [store]);

  return (
    <>
      <AppHeader title={t("modules.blockchain.title")} />
      <main className="mx-auto max-w-lg space-y-4 p-4">
        <Button asChild className="w-full">
          <Link href="/blockchain/assets/new">
            <Plus className="h-4 w-4" />
            {t("blockchain.newAsset")}
          </Link>
        </Button>

        <section>
          <h2 className="mb-2 text-sm font-medium text-gray-600">{t("blockchain.assets")}</h2>
          <ul className="space-y-2">
            {assets.map((a) => (
              <li key={a.id} className="rounded-xl bg-white p-3 shadow-sm dark:bg-gray-800">
                <div className="flex justify-between">
                  <span className="font-medium">{a.name}</span>
                  <span className="text-xs text-indigo-600">{a.asset_type}</span>
                </div>
                <p className="mt-1 truncate font-mono text-[10px] text-gray-400">{a.hash_sha256}</p>
                {a.latitude && (
                  <p className="text-xs text-gray-500">GPS: {a.latitude}, {a.longitude}</p>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-2 flex items-center gap-1 text-sm font-medium">
            <Shield className="h-4 w-4" />
            {t("blockchain.ledger")}
          </h2>
          <ul className="max-h-64 space-y-1 overflow-y-auto text-xs font-mono">
            {ledger.map((e) => (
              <li key={e.id} className="rounded bg-gray-100 p-2 dark:bg-gray-900">
                {e.action} — {e.hash_sha256.slice(0, 16)}…
              </li>
            ))}
          </ul>
        </section>

        <Link href="/blockchain/contracts" className="text-sm text-wazo-green">
          {t("blockchain.contracts")} →
        </Link>
      </main>
    </>
  );
}
