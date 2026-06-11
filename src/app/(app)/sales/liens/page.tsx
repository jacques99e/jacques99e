"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, ExternalLink, Loader2, MessageCircle, Plus, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api-client";
import { localStore } from "@/lib/db";
import { pullSalesFromCloud } from "@/lib/cloud-sync";
import {
  applyMomoLinkStatuses,
  createMomoLink,
  markMomoLinkPaid,
  momoLinkWhatsAppMessage,
  readMomoLinks,
  type MomoPaymentLink,
} from "@/lib/momo-links";
import { buildWhatsAppShareUrl } from "@/lib/module-local-tools";
import { formatCurrency } from "@/lib/utils";

export default function MomoLinksPage() {
  const store = localStore.get();
  const storeId = store?.id;
  const [storeName, setStoreName] = useState(store?.name || "Ma boutique");
  const [links, setLinks] = useState(() => readMomoLinks(storeId));
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [envLabel, setEnvLabel] = useState("");

  useEffect(() => {
    setStoreName(store?.name || localStorage.getItem("store_name") || "Ma boutique");
  }, [store?.name]);

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
      }
      return updated;
    } catch {
      return current;
    }
  }, [storeId]);

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
      const res = await apiFetch("/api/payments/momo-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label.trim(),
          amount: value,
          phone: phone.trim(),
          store_id: storeId,
          local_link_id: localId,
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
      setEnvLabel(json.payment_environment ?? "");
      setLabel("");
      setAmount("");
      setPhone("");
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

  const copyPublic = (link: MomoPaymentLink) => {
    const url = link.publicUrl || link.checkoutUrl;
    if (!url) return;
    void navigator.clipboard.writeText(url);
    setCopied(link.id);
    setTimeout(() => setCopied(null), 2000);
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
        <p className="rounded-2xl bg-orange-50 p-4 text-xs text-orange-900">
          <strong>PayDunya LIVE :</strong> créez une facture Mobile Money réelle, envoyez le lien
          WhatsApp au client — il paie en 1 clic (Orange, MTN, Moov). Confirmation automatique.
        </p>
        {envLabel ? (
          <p className="rounded-xl bg-green-50 px-3 py-2 text-xs text-green-800">{envLabel}</p>
        ) : null}
        {error ? (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
        ) : null}

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
                <span
                  className={`text-xs font-semibold ${
                    link.status === "paid"
                      ? "text-green-600"
                      : link.status === "cancelled"
                        ? "text-red-600"
                        : "text-amber-600"
                  }`}
                >
                  {link.status === "paid"
                    ? "Payé ✓"
                    : link.status === "cancelled"
                      ? "Échoué"
                      : "En attente"}
                </span>
              </div>
              <p className="text-sm text-[#075E54]">{formatCurrency(link.amountFcfa)}</p>
              <p className="text-[10px] text-gray-400">
                Réf. {link.reference}
                {link.paydunyaLive ? " • LIVE" : link.paymentEnvironment ? ` • ${link.paymentEnvironment}` : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button type="button" size="sm" className="flex-1" onClick={() => send(link)}>
                  <MessageCircle className="mr-1 h-3 w-3" /> WhatsApp
                </Button>
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
      </main>
    </div>
  );
}
