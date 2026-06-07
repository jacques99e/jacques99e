"use client";

import { useCallback, useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/contexts/I18nContext";
import { logAuditEvent } from "@/lib/audit";
import { localStore } from "@/lib/db";
import { downloadCsv, downloadSimplePdf } from "@/lib/export";
import { supabase } from "@/lib/supabase/client";

export default function ContractsPage() {
  const { t } = useI18n();
  const store = localStore.get();
  const [title, setTitle] = useState("");
  const [search, setSearch] = useState("");
  const [contractType, setContractType] = useState("cooperative");
  const [statusFilter, setStatusFilter] = useState("all");
  const [contracts, setContracts] = useState<
    { id: string; title: string; status: string; contract_type: string; participants?: unknown[] }[]
  >([]);

  const load = useCallback(async () => {
    if (!store) return;
    const { data } = await supabase.from("blockchain_contracts").select("*").eq("store_id", store.id);
    if (data) setContracts(data);
  }, [store]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!store || !title) return;
    const { data } = await supabase
      .from("blockchain_contracts")
      .insert({
      store_id: store.id,
      title,
      contract_type: contractType,
      rules: { revenue_share: "equal", traceability: true },
      participants: [],
      })
      .select("id")
      .single();
    await logAuditEvent({
      action: "blockchain_contract_created",
      entityType: "blockchain_contract",
      entityId: data?.id,
      payload: { title, contract_type: contractType },
    });
    setTitle("");
    setContractType("cooperative");
    load();
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("blockchain_contracts").update({ status }).eq("id", id);
    await logAuditEvent({
      action: "blockchain_contract_status_updated",
      entityType: "blockchain_contract",
      entityId: id,
      payload: { status },
    });
    load();
  };

  const filteredContracts = contracts.filter((contract) => {
    const searchOk = contract.title.toLowerCase().includes(search.trim().toLowerCase());
    const statusOk = statusFilter === "all" || contract.status === statusFilter;
    return searchOk && statusOk;
  });

  const prettyStatus = (status: string) => {
    if (status === "active") return "Actif";
    if (status === "paused") return "En pause";
    if (status === "closed") return "Cloture";
    return status;
  };

  return (
    <>
      <AppHeader title={t("blockchain.contracts")} />
      <main className="mx-auto max-w-lg space-y-4 p-4">
        <div className="grid grid-cols-2 gap-2 text-center text-xs">
          <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-gray-800">
            <p className="text-xl font-semibold text-[#075E54]">{contracts.length}</p>
            <p>Total contrats</p>
          </div>
          <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-gray-800">
            <p className="text-xl font-semibold text-[#075E54]">{contracts.filter((c) => c.status === "active").length}</p>
            <p>Actifs</p>
          </div>
        </div>

        <div className="space-y-2 rounded-xl bg-white p-3 shadow-sm dark:bg-gray-800">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("blockchain.contractTitle")} />
          <select
            value={contractType}
            onChange={(e) => setContractType(e.target.value)}
            className="flex h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm"
          >
            <option value="cooperative">Coopérative</option>
            <option value="vente">Vente</option>
            <option value="achat">Achat</option>
            <option value="partenariat">Partenariat</option>
          </select>
          <Button onClick={create} className="w-full">
            {t("common.save")}
          </Button>
        </div>

        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un contrat..." />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button
            variant="outline"
            onClick={() =>
              downloadCsv(
                `contrats-blockchain-${new Date().toISOString().slice(0, 10)}.csv`,
                filteredContracts.map((contract) => ({
                  id: contract.id,
                  title: contract.title,
                  contract_type: contract.contract_type,
                  status: contract.status,
                  participants: Array.isArray(contract.participants) ? contract.participants.length : 0,
                }))
              )
            }
          >
            Export CSV
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              void downloadSimplePdf(
                "Contrats blockchain",
                filteredContracts.map(
                  (contract) =>
                    `${contract.title} | ${contract.contract_type} | ${prettyStatus(contract.status)} | Participants: ${
                      Array.isArray(contract.participants) ? contract.participants.length : 0
                    }`
                ),
                `contrats-blockchain-${new Date().toISOString().slice(0, 10)}.pdf`
              )
            }
          >
            Export PDF
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {["all", "active", "paused", "closed"].map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`rounded-full px-3 py-1 text-xs ${
                statusFilter === status ? "bg-[#075E54] text-white" : "bg-gray-100 text-gray-700"
              }`}
            >
              {status === "all" ? "Tous" : status}
            </button>
          ))}
        </div>
        <ul className="space-y-2">
          {filteredContracts.map((c) => (
            <li key={c.id} className="rounded-xl bg-white p-3 shadow-sm dark:bg-gray-800">
              <p className="font-medium">{c.title}</p>
              <p className="text-xs text-gray-500">
                {c.contract_type} • participants: {Array.isArray(c.participants) ? c.participants.length : 0}
              </p>
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-gray-500">Statut: {prettyStatus(c.status)}</p>
                <select
                  value={c.status}
                  onChange={(e) => updateStatus(c.id, e.target.value)}
                  className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs"
                >
                  <option value="active">active</option>
                  <option value="paused">paused</option>
                  <option value="closed">closed</option>
                </select>
              </div>
            </li>
          ))}
        </ul>
        {filteredContracts.length === 0 ? (
          <p className="rounded-xl bg-white p-4 text-sm text-gray-500 shadow-sm">Aucun contrat trouvé.</p>
        ) : null}
      </main>
    </>
  );
}
