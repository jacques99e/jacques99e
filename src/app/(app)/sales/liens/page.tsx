"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Copy,
  Download,
  ExternalLink,
  History,
  Loader2,
  MessageCircle,
  Plus,
  RefreshCw,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api-client";
import { localStore } from "@/lib/db";
import { pullSalesFromCloud } from "@/lib/cloud-sync";
import { downloadCsv } from "@/lib/export";
import {
  downloadMomoReceiptPdf,
  momoHistoryExportRows,
  type MomoReceiptData,
} from "@/lib/momo-receipt";
import {
  applyMomoLinkStatuses,
  createMomoLink,
  isStaleMomoLink,
  markMomoLinkPaid,
  momoLinkReminderMessage,
  momoLinkWhatsAppMessage,
  readMomoLinks,
  type MomoPaymentLink,
} from "@/lib/momo-links";
import { buildWhatsAppShareUrl } from "@/lib/module-local-tools";
import { formatCurrency } from "@/lib/utils";

interface ServerMomoPayment {
  transaction_id: string;
  reference: string;
  label: string;
  amount: number;
  status: string;
  customer_phone: string | null;
  sale_id: string | null;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
}

type Tab = "active" | "history";

function statusLabel(status: string) {
  if (status === "succeeded" || status === "paid") return "Payé ✓";
  if (status === "failed" || status === "cancelled") return "Échoué";
  return "En attente";
}

function statusClass(status: string) {
  if (status === "succeeded" || status === "paid") return "text-green-600";
  if (status === "failed" || status === "cancelled") return "text-red-600";
  return "text-amber-600";
}

export default function MomoLinksPage() {
  const searchParams = useSearchParams();
  const store = localStore.get();
  const storeId = store?.id;
  const [storeName, setStoreName] = useState(store?.name || "Ma boutique");
  const [links, setLinks] = useState(() => readMomoLinks(storeId));
  const [history, setHistory] = useState<ServerMomoPayment[]>([]);
  const [tab, setTab] = useState<Tab>("active");
  const [historyFilter, setHistoryFilter] = useState("all");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [creating, setCreating] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [envLabel, setEnvLabel] = useState("");

  useEffect(() => {
    setStoreName(store?.name || localStorage.getItem("store_name") || "Ma boutique");
  }, [store?.name]);

  useEffect(() => {
    const preLabel = searchParams.get("label");
    const preAmount = searchParams.get("amount");
    const prePhone = searchParams.get("phone");
    if (preLabel) setLabel(preLabel);
    if (preAmount) setAmount(preAmount);
    if (prePhone) setPhone(prePhone);
  }, [searchParams]);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const qs =
        historyFilter === "all" ? "" : `?status=${historyFilter === "paid" ? "succeeded" : historyFilter}`;
      const res = await apiFetch(`/api/payments/momo-link/history${qs}`);
      const json = (await res.json()) as {
        success: boolean;
        payments?: ServerMomoPayment[];
        store_name?: string;
      };
      if (res.ok && json.success && json.payments) {
        setHistory(json.payments);
        if (json.store_name) setStoreName(json.store_name);
      }
    } catch {
      /* offline */
    } finally {
      setLoadingHistory(false);
    }
  }, [historyFilter]);

  useEffect(() => {
    if (tab === "history") void loadHistory();
  }, [tab, loadHistory]);

  const syncStatuses = useCallback(async (current: MomoPaymentLink[]) => {
    const pending = current.filter((l) => l.status === "pending" && l.transactionId);
    if (!pending.length) return current;

    const txs = pending.map((l) => l.transactionId!).join(",");
    try {
      const res = await apiFetch(`/api/payments/momo-link?transactions=${encodeURIComponent(txs)}`);
      const json = (await res.json()) as {
        success: boolean;
        payments?: Array<{ transaction_id: string; status: string }>;
      };
      if (!res.ok || !json.success || !json.payments) return current;

      const updated = applyMomoLinkStatuses(current, json.payments, storeId);
      const newlyPaid = updated.filter((l) => {
        if (l.status !== "paid") return false;
        const old = current.find((c) => c.id === l.id);
        return old?.status === "pending";
      });
      if (newlyPaid.length && storeId) {
        await pullSalesFromCloud(storeId, []);
        setEnvLabel(
          `${newlyPaid.length} paiement(s) confirmé(s) — vente enregistrée en caisse`
        );
        void loadHistory();
      }
      return updated;
    } catch {
      return current;
    }
  }, [storeId, loadHistory]);

  useEffect(() => {
    void syncStatuses(links).then(setLinks);
    const interval = setInterval(() => {
      setLinks((prev) => {
        void syncStatuses(prev).then(setLinks);
        return prev;
      });
    }, 10000);
    return () => clearInterval(interval);
  }, [syncStatuses]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const value = Number(amount);
    if (!label.trim() || value <= 0) return;

    setCreating(true);
    try {
      const localId = `momo-local-${Date.now()}`;
      const itemsParam = searchParams.get("items");
      let items: unknown;
      if (itemsParam) {
        try {
          items = JSON.parse(decodeURIComponent(itemsParam));
        } catch {
          items = undefined;
        }
      }

      const res = await apiFetch("/api/payments/momo-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label.trim(),
          amount: value,
          phone: phone.trim(),
          store_id: storeId,
          local_link_id: localId,
          items,
        }),
      });
      const json = (await res.json()) as {
        success: boolean;
        error?: string;
        checkout_url?: string;
        public_url?: string;
        transaction_id?: string;
        reference?: string;
        payment_environment?: string;
        paydunya_live?: boolean;
      };

      if (!res.ok || !json.success) {
        setError(json.error ?? "Impossible de créer le lien PayDunya.");
        return;
      }

      setLinks(
        createMomoLink(
          {
            label: label.trim(),
            amountFcfa: value,
            customerPhone: phone.trim(),
            reference: json.reference,
            transactionId: json.transaction_id,
            checkoutUrl: json.checkout_url,
            publicUrl: json.public_url,
            paymentEnvironment: json.payment_environment,
            paydunyaLive: json.paydunya_live,
          },
          storeId
        )
      );
      setEnvLabel(json.payment_environment ?? "Lien créé");
      setLabel("");
      setAmount("");
      setPhone("");
      void loadHistory();
    } catch {
      setError("Erreur réseau. Réessayez.");
    } finally {
      setCreating(false);
    }
  };

  const send = (link: MomoPaymentLink) => {
    const msg = momoLinkWhatsAppMessage({
      storeName,
      amountFcfa: link.amountFcfa,
      label: link.label,
      reference: link.reference,
      checkoutUrl: link.checkoutUrl,
      publicUrl: link.publicUrl,
    });
    window.open(
      buildWhatsAppShareUrl(msg, link.customerPhone || undefined),
      "_blank",
      "noopener,noreferrer"
    );
  };

  const remind = (link: MomoPaymentLink) => {
    const msg = momoLinkReminderMessage({
      storeName,
      amountFcfa: link.amountFcfa,
      label: link.label,
      reference: link.reference,
      publicUrl: link.publicUrl,
      checkoutUrl: link.checkoutUrl,
    });
    window.open(
      buildWhatsAppShareUrl(msg, link.customerPhone || undefined),
      "_blank",
      "noopener,noreferrer"
    );
  };

  const remindServer = (row: ServerMomoPayment) => {
    const msg = momoLinkReminderMessage({
      storeName,
      amountFcfa: row.amount,
      label: row.label,
      reference: row.reference,
      publicUrl: `${window.location.origin}/paiement/${encodeURIComponent(row.reference)}`,
    });
    window.open(
      buildWhatsAppShareUrl(msg, row.customer_phone || undefined),
      "_blank",
      "noopener,noreferrer"
    );
  };

  const copyPublic = (link: MomoPaymentLink) => {
    const url = link.publicUrl || link.checkoutUrl;
    if (!url) return;
    void navigator.clipboard.writeText(url);
    setCopied(link.id);
    setTimeout(() => setCopied(null), 2000);
  };

  const exportReceipt = async (row: ServerMomoPayment) => {
    const data: MomoReceiptData = {
      storeName,
      label: row.label,
      reference: row.reference,
      amountFcfa: row.amount,
      status: row.status,
      customerPhone: row.customer_phone,
      paidAt: row.paid_at ?? undefined,
      transactionId: row.transaction_id,
      saleId: row.sale_id,
    };
    await downloadMomoReceiptPdf(data);
  };

  const exportHistoryCsv = () => {
    downloadCsv(
      `momo-historique-${new Date().toISOString().slice(0, 10)}.csv`,
      momoHistoryExportRows(history)
    );
  };

  return (
    <div className="min-h-screen bg-[#F5F5F0] pb-24">
      <header className="bg-[#075E54] px-4 py-4 text-white">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <Smartphone className="h-5 w-5" /> Liens MoMo PayDunya
          </h1>
          <Link href="/sales"><ArrowLeft className="h-4 w-4" /></Link>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 p-4">
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={tab === "active" ? "default" : "outline"}
            className="flex-1"
            onClick={() => setTab("active")}
          >
            <Plus className="mr-1 h-3 w-3" /> Créer
          </Button>
          <Button
            type="button"
            size="sm"
            variant={tab === "history" ? "default" : "outline"}
            className="flex-1"
            onClick={() => setTab("history")}
          >
            <History className="mr-1 h-3 w-3" /> Historique
          </Button>
        </div>

        {envLabel ? (
          <p className="rounded-xl bg-green-50 px-3 py-2 text-xs text-green-800">{envLabel}</p>
        ) : null}
        {error ? (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
        ) : null}

        {tab === "active" ? (
          <>
            <p className="rounded-2xl bg-orange-50 p-4 text-xs text-orange-900">
              <strong>PayDunya LIVE :</strong> facture Mobile Money réelle, lien WhatsApp, paiement
              1 clic — vente auto en caisse à la confirmation.
            </p>

            <form onSubmit={(e) => void submit(e)} className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
              <div>
                <Label>Motif</Label>
                <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Commande #12" required />
              </div>
              <div>
                <Label>Montant (FCFA)</Label>
                <Input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} required />
              </div>
              <div>
                <Label>Téléphone client (WhatsApp)</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+228..." />
              </div>
              <Button type="submit" className="w-full" disabled={creating}>
                {creating ? (
                  <>
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Création PayDunya…
                  </>
                ) : (
                  <>
                    <Plus className="mr-1 h-4 w-4" /> Créer lien de paiement
                  </>
                )}
              </Button>
            </form>

            <ul className="space-y-2">
              {links.map((link) => (
                <li key={link.id} className="rounded-2xl bg-white p-4 shadow-sm">
                  <div className="flex justify-between">
                    <p className="font-medium">{link.label}</p>
                    <span className={`text-xs font-semibold ${statusClass(link.status)}`}>
                      {statusLabel(link.status)}
                    </span>
                  </div>
                  <p className="text-sm text-[#075E54]">{formatCurrency(link.amountFcfa)}</p>
                  <p className="text-[10px] text-gray-400">
                    Réf. {link.reference}
                    {link.paydunyaLive ? " • LIVE" : link.paymentEnvironment ? ` • ${link.paymentEnvironment}` : ""}
                    {link.status === "pending" && isStaleMomoLink(link.createdAt) ? " • +24 h" : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button type="button" size="sm" className="flex-1" onClick={() => send(link)}>
                      <MessageCircle className="mr-1 h-3 w-3" /> WhatsApp
                    </Button>
                    {link.status === "pending" && isStaleMomoLink(link.createdAt) ? (
                      <Button type="button" size="sm" variant="outline" onClick={() => remind(link)}>
                        Relancer
                      </Button>
                    ) : null}
                    {link.publicUrl || link.checkoutUrl ? (
                      <Button type="button" size="sm" variant="outline" onClick={() => copyPublic(link)}>
                        <Copy className="mr-1 h-3 w-3" />
                        {copied === link.id ? "Copié" : "Lien"}
                      </Button>
                    ) : null}
                    {link.checkoutUrl && link.status === "pending" ? (
                      <Button type="button" size="sm" variant="outline" asChild>
                        <a href={link.checkoutUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="mr-1 h-3 w-3" /> PayDunya
                        </a>
                      </Button>
                    ) : null}
                    {link.status === "pending" && !link.transactionId ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setLinks(markMomoLinkPaid(link.id, storeId))}
                      >
                        Marquer payé
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {(["all", "pending", "paid", "failed"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setHistoryFilter(f)}
                  className={`rounded-full px-3 py-1 text-xs ${
                    historyFilter === f ? "bg-[#075E54] text-white" : "bg-white text-gray-600"
                  }`}
                >
                  {f === "all" ? "Tous" : f === "paid" ? "Payés" : f === "pending" ? "En attente" : "Échoués"}
                </button>
              ))}
              <Button type="button" size="sm" variant="outline" onClick={() => void loadHistory()}>
                <RefreshCw className={`h-3 w-3 ${loadingHistory ? "animate-spin" : ""}`} />
              </Button>
              {history.length > 0 ? (
                <Button type="button" size="sm" variant="outline" onClick={exportHistoryCsv}>
                  <Download className="mr-1 h-3 w-3" /> CSV
                </Button>
              ) : null}
            </div>

            {loadingHistory ? (
              <p className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
              </p>
            ) : history.length === 0 ? (
              <p className="rounded-xl bg-white p-4 text-center text-xs text-gray-500">Aucun paiement.</p>
            ) : (
              <ul className="space-y-2">
                {history.map((row) => (
                  <li key={row.transaction_id} className="rounded-2xl bg-white p-4 shadow-sm">
                    <div className="flex justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{row.label}</p>
                        <p className="text-sm text-[#075E54]">{formatCurrency(row.amount)}</p>
                        <p className="text-[10px] text-gray-400">
                          Réf. {row.reference} • {new Date(row.created_at).toLocaleDateString("fr-FR")}
                        </p>
                      </div>
                      <span className={`shrink-0 text-xs font-semibold ${statusClass(row.status)}`}>
                        {statusLabel(row.status)}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {row.status === "pending" ? (
                        <Button type="button" size="sm" variant="outline" onClick={() => remindServer(row)}>
                          Relancer
                        </Button>
                      ) : null}
                      {row.status === "succeeded" ? (
                        <>
                          <Button type="button" size="sm" variant="outline" onClick={() => void exportReceipt(row)}>
                            <Download className="mr-1 h-3 w-3" /> Reçu PDF
                          </Button>
                          {row.sale_id ? (
                            <Button type="button" size="sm" variant="outline" asChild>
                              <Link href="/sales/history">Voir caisse</Link>
                            </Button>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>
    </div>
  );
}
