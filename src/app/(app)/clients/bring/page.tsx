"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Copy, MessageCircle, QrCode, Share2 } from "lucide-react";
import QRCode from "qrcode";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import {
  boutiquePublicUrl,
  boutiqueShareText,
  readBringClientProgress,
  writeBringClientProgress,
  type BringClientActionId,
  type BringClientProgress,
} from "@/lib/bring-clients";
import { localStore } from "@/lib/db";
import { buildWhatsAppShareUrl } from "@/lib/whatsapp-share";

const ACTIONS: Array<{
  id: BringClientActionId;
  title: string;
  hint: string;
}> = [
  {
    id: "status",
    title: "1. Status WhatsApp (24 h)",
    hint: "Publiez le lien boutique en Status. Vos contacts le voient sans que vous écriviez un par un.",
  },
  {
    id: "contacts",
    title: "2. 10 personnes qui vous connaissent",
    hint: "Envoyez le message prérempli à famille, voisins, collègues — pas à des inconnus.",
  },
  {
    id: "qr",
    title: "3. QR au comptoir",
    hint: "Montrez le QR à un client présent. Il ouvre la boutique sans taper le lien.",
  },
];

export default function BringClientsPage() {
  const store = localStore.get();
  const storeName = store?.name || "Ma boutique";
  const url = boutiquePublicUrl(store?.slug);
  const shareText = url ? boutiqueShareText(storeName, url) : "";
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [done, setDone] = useState<BringClientProgress>({
    status: false,
    contacts: false,
    qr: false,
  });

  useEffect(() => {
    setDone(readBringClientProgress(store?.id));
  }, [store?.id]);

  useEffect(() => {
    if (!url) {
      setQrDataUrl("");
      return;
    }
    void QRCode.toDataURL(url, { width: 220, margin: 2 }).then(setQrDataUrl);
  }, [url]);

  function toggle(id: BringClientActionId) {
    const next = { ...done, [id]: !done[id] };
    setDone(next);
    writeBringClientProgress(store?.id, next);
  }

  async function copyLink() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function nativeShare() {
    if (!url) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: storeName, text: shareText, url });
        return;
      } catch {
        /* user cancelled or unsupported */
      }
    }
    window.open(buildWhatsAppShareUrl(shareText), "_blank", "noopener,noreferrer");
  }

  const completed = [done.status, done.contacts, done.qr].filter(Boolean).length;

  return (
    <>
      <AppHeader title="Amener des clients" subtitle="Commerce" />
      <main className="app-page space-y-4 pb-6">
        <section className="app-card border-[#FF6F00]/25 bg-gradient-to-br from-white to-[#FFF5EB] p-4">
          <p className="text-sm font-semibold text-gray-900">
            Wazo enregistre les ventes. C&apos;est vous qui amenez les clients.
          </p>
          <p className="mt-1 text-xs text-gray-600">
            3 actions aujourd&apos;hui. Cochez au fur et à mesure — {completed}/3.
          </p>
          <div className="mt-3 flex gap-1.5">
            {[1, 2, 3].map((n) => (
              <span
                key={n}
                className={`h-1.5 flex-1 rounded-full ${
                  n <= completed ? "bg-[#FF6F00]" : "bg-gray-200"
                }`}
              />
            ))}
          </div>
        </section>

        {!url ? (
          <section className="app-card p-4 text-sm text-amber-800">
            Votre boutique n&apos;a pas encore de lien public. Terminez la configuration, puis
            revenez ici.
            <Button asChild className="mt-3 w-full" variant="outline">
              <Link href="/setup">Ouvrir la configuration</Link>
            </Button>
          </section>
        ) : (
          <>
            <section className="app-card space-y-3 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Lien boutique
              </p>
              <p className="break-all rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-800">
                {url}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" onClick={() => void copyLink()}>
                  <Copy className="h-4 w-4" />
                  {copied ? "Copié" : "Copier"}
                </Button>
                <Button type="button" onClick={() => void nativeShare()}>
                  <Share2 className="h-4 w-4" />
                  Partager
                </Button>
              </div>
              <a
                href={buildWhatsAppShareUrl(shareText)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] text-sm font-semibold text-white"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp — Status ou contact
              </a>
            </section>

            <section className="app-card space-y-3 p-4">
              {ACTIONS.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => toggle(action.id)}
                  className="flex w-full items-start gap-3 rounded-xl border border-gray-100 p-3 text-left"
                >
                  <span
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                      done[action.id]
                        ? "bg-wazo-green text-white"
                        : "border border-gray-300 bg-white"
                    }`}
                  >
                    {done[action.id] ? <Check className="h-3.5 w-3.5" /> : null}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{action.title}</span>
                    <span className="mt-0.5 block text-xs text-gray-600">{action.hint}</span>
                  </span>
                </button>
              ))}
            </section>

            <section className="app-card space-y-3 p-4 text-center">
              <p className="flex items-center justify-center gap-2 text-sm font-semibold">
                <QrCode className="h-4 w-4 text-wazo-green" />
                QR à montrer au client
              </p>
              {qrDataUrl ? (
                <Image
                  src={qrDataUrl}
                  alt="QR boutique"
                  width={176}
                  height={176}
                  unoptimized
                  className="mx-auto rounded-xl border border-gray-100"
                />
              ) : null}
              <p className="text-xs text-gray-500">
                Affichez-le au comptoir ou enregistrez la capture dans votre galerie.
              </p>
            </section>
          </>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Button asChild variant="outline">
            <Link href="/sales">Ouvrir la caisse</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/clients">Mini CRM</Link>
          </Button>
        </div>
      </main>
    </>
  );
}
