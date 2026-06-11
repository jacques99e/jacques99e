"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MessageCircle, Plus, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { localStore } from "@/lib/db";
import {
  createMomoLink,
  markMomoLinkPaid,
  momoLinkWhatsAppMessage,
  readMomoLinks,
} from "@/lib/momo-links";
import { buildWhatsAppShareUrl } from "@/lib/module-local-tools";
import { formatCurrency } from "@/lib/utils";

export default function MomoLinksPage() {
  const store = localStore.get();
  const storeId = store?.id;
  const [storeName, setStoreName] = useState(store?.name || "Ma boutique");
  const [links, setLinks] = useState(() => readMomoLinks(storeId));

  useEffect(() => {
    setStoreName(store?.name || localStorage.getItem("store_name") || "Ma boutique");
  }, [store?.name]);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(amount);
    if (!label.trim() || value <= 0) return;
    setLinks(
      createMomoLink(
        { label: label.trim(), amountFcfa: value, customerPhone: phone.trim() },
        storeId
      )
    );
    setLabel("");
    setAmount("");
    setPhone("");
  };

  const send = (link: (typeof links)[0]) => {
    const msg = momoLinkWhatsAppMessage({
      storeName,
      amountFcfa: link.amountFcfa,
      label: link.label,
      reference: link.reference,
    });
    window.open(
      buildWhatsAppShareUrl(msg, link.customerPhone || undefined),
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <div className="min-h-screen bg-[#F5F5F0] pb-24">
      <header className="bg-[#075E54] px-4 py-4 text-white">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <Smartphone className="h-5 w-5" /> Liens MoMo
          </h1>
          <Link href="/sales"><ArrowLeft className="h-4 w-4" /></Link>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 p-4">
        <p className="rounded-2xl bg-orange-50 p-4 text-xs text-orange-900">
          Encaissez à distance : générez une demande de paiement Mobile Money avec référence unique
          et envoyez-la par WhatsApp — sans terminal physique.
        </p>

        <form onSubmit={submit} className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
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
          <Button type="submit" className="w-full">
            <Plus className="mr-1 h-4 w-4" /> Créer le lien
          </Button>
        </form>

        <ul className="space-y-2">
          {links.map((link) => (
            <li key={link.id} className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex justify-between">
                <p className="font-medium">{link.label}</p>
                <span
                  className={`text-xs font-semibold ${
                    link.status === "paid" ? "text-green-600" : "text-amber-600"
                  }`}
                >
                  {link.status === "paid" ? "Payé" : "En attente"}
                </span>
              </div>
              <p className="text-sm text-[#075E54]">{formatCurrency(link.amountFcfa)}</p>
              <p className="text-[10px] text-gray-400">Réf. {link.reference}</p>
              <div className="mt-2 flex gap-2">
                <Button type="button" size="sm" className="flex-1" onClick={() => send(link)}>
                  <MessageCircle className="mr-1 h-3 w-3" /> WhatsApp
                </Button>
                {link.status === "pending" ? (
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
