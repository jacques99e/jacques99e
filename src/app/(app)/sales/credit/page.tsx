"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MessageCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/contexts/I18nContext";
import { localStore } from "@/lib/db";
import {
  addCreditEntry,
  balanceByClient,
  readCreditLedger,
  totalOutstanding,
  type CreditEntryType,
} from "@/lib/commerce-credit";
import { buildWhatsAppShareUrl } from "@/lib/module-local-tools";
import { formatCurrency } from "@/lib/utils";

export default function CreditLedgerPage() {
  const { t, lang } = useI18n();
  const storeId = localStore.get()?.id;
  const [entries, setEntries] = useState(() => readCreditLedger(storeId));
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<CreditEntryType>("debt");
  const [note, setNote] = useState("");

  const balances = useMemo(() => balanceByClient(entries), [entries]);
  const outstanding = useMemo(() => totalOutstanding(entries), [entries]);

  const debtors = useMemo(() => {
    return Object.entries(balances)
      .filter(([, bal]) => bal > 0)
      .sort((a, b) => b[1] - a[1]);
  }, [balances]);

  const locale = lang === "fr" ? "fr-FR" : lang === "en" ? "en-US" : lang;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(amount);
    if (!clientName.trim() || value <= 0) return;
    setEntries(
      addCreditEntry(
        {
          clientName: clientName.trim(),
          clientPhone: clientPhone.trim(),
          amount: value,
          type,
          note: note.trim(),
        },
        storeId
      )
    );
    setAmount("");
    setNote("");
  };

  const remind = (name: string, phone: string, balance: number) => {
    const msg = t("credit.remindMsg", {
      name,
      amount: formatCurrency(balance),
    });
    if (phone) {
      window.open(buildWhatsAppShareUrl(msg, phone), "_blank", "noopener,noreferrer");
    } else {
      void navigator.clipboard.writeText(msg);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F0] pb-24">
      <header className="bg-[#075E54] px-4 py-4 text-white shadow-sm">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <h1 className="text-lg font-semibold">{t("credit.title")}</h1>
          <Link href="/sales" className="text-sm text-white/90">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 p-4">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">{t("credit.totalOutstanding")}</p>
          <p className="text-2xl font-bold text-[#075E54]">{formatCurrency(outstanding)}</p>
          <p className="mt-1 text-xs text-gray-500">
            {t("credit.debtorsCount", { count: debtors.length })}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-800">{t("credit.newEntry")}</h2>
          <div>
            <Label>{t("credit.clientName")}</Label>
            <Input value={clientName} onChange={(e) => setClientName(e.target.value)} required />
          </div>
          <div>
            <Label>{t("credit.clientPhone")}</Label>
            <Input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="+228..." />
          </div>
          <div>
            <Label>{t("credit.amount")}</Label>
            <Input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={type === "debt" ? "default" : "outline"}
              className="flex-1"
              onClick={() => setType("debt")}
            >
              {t("credit.debt")}
            </Button>
            <Button
              type="button"
              variant={type === "payment" ? "default" : "outline"}
              className="flex-1"
              onClick={() => setType("payment")}
            >
              {t("credit.payment")}
            </Button>
          </div>
          <div>
            <Label>{t("credit.note")}</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("credit.notePlaceholder")}
            />
          </div>
          <Button type="submit" className="w-full">
            <Plus className="mr-1 h-4 w-4" /> {t("credit.save")}
          </Button>
        </form>

        {debtors.length > 0 ? (
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold">{t("credit.toRemind")}</h2>
            <ul className="space-y-2">
              {debtors.map(([key, bal]) => {
                const last = entries.find(
                  (e) => (e.clientPhone || e.clientName) === key && e.type === "debt"
                );
                return (
                  <li key={key} className="flex items-center justify-between rounded-lg bg-amber-50 p-3 text-sm">
                    <div>
                      <p className="font-medium">{last?.clientName ?? key}</p>
                      <p className="text-xs text-gray-500">{formatCurrency(bal)}</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => remind(last?.clientName ?? key, last?.clientPhone ?? "", bal)}
                    >
                      <MessageCircle className="h-3 w-3" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold">{t("credit.history")}</h2>
          {entries.length === 0 ? (
            <p className="text-xs text-gray-500">{t("credit.empty")}</p>
          ) : (
            <ul className="space-y-2">
              {entries.slice(0, 15).map((row) => (
                <li key={row.id} className="rounded-lg border p-2 text-xs">
                  <div className="flex justify-between">
                    <span className="font-medium">{row.clientName}</span>
                    <span className={row.type === "debt" ? "text-red-600" : "text-green-600"}>
                      {row.type === "debt" ? "+" : "-"}
                      {formatCurrency(row.amount)}
                    </span>
                  </div>
                  <p className="text-gray-500">
                    {new Date(row.createdAt).toLocaleDateString(locale)}
                    {row.note ? ` — ${row.note}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
