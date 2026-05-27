"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/contexts/I18nContext";
import { localStore } from "@/lib/db";
import { supabase } from "@/lib/supabase/client";

export default function ContractsPage() {
  const { t } = useI18n();
  const store = localStore.get();
  const [title, setTitle] = useState("");
  const [contracts, setContracts] = useState<{ id: string; title: string; status: string }[]>([]);

  const load = async () => {
    if (!store) return;
    const { data } = await supabase.from("blockchain_contracts").select("*").eq("store_id", store.id);
    if (data) setContracts(data);
  };

  useEffect(() => {
    if (store) load();
  }, [store]);

  const create = async () => {
    if (!store || !title) return;
    await supabase.from("blockchain_contracts").insert({
      store_id: store.id,
      title,
      contract_type: "cooperative",
      rules: { revenue_share: "equal", traceability: true },
      participants: [],
    });
    setTitle("");
    load();
  };

  return (
    <>
      <AppHeader title={t("blockchain.contracts")} />
      <main className="mx-auto max-w-lg space-y-4 p-4">
        <div className="flex gap-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("blockchain.contractTitle")} />
          <Button onClick={create}>{t("common.save")}</Button>
        </div>
        <ul className="space-y-2">
          {contracts.map((c) => (
            <li key={c.id} className="rounded-xl bg-white p-3 shadow-sm dark:bg-gray-800">
              <p className="font-medium">{c.title}</p>
              <p className="text-xs text-gray-500">{c.status}</p>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
