"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircle, Plus, QrCode, Shield } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/contexts/I18nContext";
import { localStore } from "@/lib/db";
import { ModuleCompetitiveEdge } from "@/components/ModuleCompetitiveEdge";
import { ModuleMenuLink } from "@/components/ModuleMenuLink";
import { ModulePublicPortals } from "@/components/ModulePublicPortals";
import { ModuleStatGrid } from "@/components/ModuleStatGrid";
import { traceUrl } from "@/lib/blockchain-public";
import { celoExplorerTxUrl } from "@/lib/celo";
import { shareTraceLink } from "@/lib/module-share";
import { buildWhatsAppShareUrl } from "@/lib/whatsapp-share";
import { listAssets, listLedger, verifyAssetHash } from "@/lib/blockchain";
import type { BlockchainAsset, BlockchainLedgerEntry } from "@/types";

export default function BlockchainPage() {
  const { t } = useI18n();
  const store = localStore.get();
  const [assets, setAssets] = useState<BlockchainAsset[]>([]);
  const [ledger, setLedger] = useState<BlockchainLedgerEntry[]>([]);
  const [search, setSearch] = useState("");
  const [verifiedMap, setVerifiedMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!store) return;
    listAssets(store.id).then(async (rows) => {
      setAssets(rows);
      const checks = await Promise.all(rows.map(async (row) => [row.id, await verifyAssetHash(row)] as const));
      setVerifiedMap(Object.fromEntries(checks));
    });
    listLedger(store.id).then(setLedger);
  }, [store]);

  const filteredAssets = assets.filter((asset) =>
    asset.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <>
      <AppHeader title={t("modules.blockchain.title")} subtitle={t("hub.module")} />
      <main className="app-page space-y-4 pb-6">
        <ModuleStatGrid
          columns={3}
          items={[
            { value: assets.length, label: "Actifs", accent: "text-sky-600" },
            { value: ledger.length, label: "Écritures", accent: "text-sky-600" },
            {
              value: assets.filter((a) => Boolean(a.celo_tx_hash)).length,
              label: "Sur Celo",
              accent: "text-emerald-600",
            },
          ]}
        />
        <ModulePublicPortals moduleId="blockchain" />
        <ModuleCompetitiveEdge moduleId="blockchain" />

        <ModuleMenuLink
          href="/blockchain/qr"
          icon={QrCode}
          title="QR sur étiquettes"
          description="Code scannable pour vérification /trace"
          iconClassName="bg-indigo-600/10 text-indigo-800"
        />

        <Button asChild className="w-full">
          <Link href="/blockchain/assets/new">
            <Plus className="h-4 w-4" />
            {t("blockchain.newAsset")}
          </Link>
        </Button>

        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un actif..."
        />

        <section>
          <h2 className="mb-2 text-sm font-medium text-gray-600">{t("blockchain.assets")}</h2>
          <ul className="space-y-2">
            {filteredAssets.map((a) => (
              <li key={a.id} className="app-card p-3">
                <div className="flex justify-between">
                  <span className="font-medium">{a.name}</span>
                  <span className="text-xs text-indigo-600">{a.asset_type}</span>
                </div>
                <p className="mt-1 truncate font-mono text-[10px] text-gray-400">{a.hash_sha256}</p>
                <p className="text-xs">
                  Hash:{" "}
                  <span className={verifiedMap[a.id] ? "text-green-700" : "text-amber-700"}>
                    {verifiedMap[a.id] ? "valide" : "à vérifier"}
                  </span>
                </p>
                {a.celo_tx_hash ? (
                  <p className="text-xs text-emerald-700">
                    Celo ({a.celo_network || "alfajores"}) —{" "}
                    <a
                      href={celoExplorerTxUrl(a.celo_network || "alfajores", a.celo_tx_hash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      voir sur l&apos;explorateur
                    </a>
                  </p>
                ) : null}
                {a.latitude && (
                  <p className="text-xs text-gray-500">GPS: {a.latitude}, {a.longitude}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="text-[10px] text-indigo-600 underline"
                    onClick={() => void navigator.clipboard.writeText(traceUrl(a.hash_sha256))}
                  >
                    Copier lien
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full bg-[#25D366]/15 px-2 py-0.5 text-[10px] text-[#128C7E]"
                    onClick={() => {
                      const { message } = shareTraceLink({ assetName: a.name, hash: a.hash_sha256 });
                      window.open(buildWhatsAppShareUrl(message), "_blank", "noopener,noreferrer");
                    }}
                  >
                    <MessageCircle className="h-3 w-3" />
                    Partager WhatsApp
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {filteredAssets.length === 0 ? (
            <p className="rounded-xl bg-white p-3 text-sm text-gray-500 shadow-sm dark:bg-gray-800">
              Aucun actif trouvé.
            </p>
          ) : null}
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
