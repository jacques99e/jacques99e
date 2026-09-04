"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Copy, MessageCircle, Share2 } from "lucide-react";
import QRCode from "qrcode";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import { isPaidSubscriber, type BillingSubscription } from "@/lib/billing";
import {
  BRING_STEP_IDS,
  boutiquePublicUrl,
  boutiqueShareText,
  markBringStepDone,
  readBringClientProgress,
  writeBringClientProgress,
  type BringClientProgress,
  type BringClientStepId,
} from "@/lib/bring-clients";
import { localStore } from "@/lib/db";
import { buildWhatsAppShareUrl } from "@/lib/whatsapp-share";

const STEP_COPY: Record<
  BringClientStepId,
  { title: string; hint: string; doneLabel: string }
> = {
  link: {
    title: "Préparez votre lien boutique",
    hint: "Copiez ou partagez le lien. C’est l’adresse que vos clients ouvriront.",
    doneLabel: "Lien prêt — continuer",
  },
  status: {
    title: "Publiez en Status WhatsApp",
    hint: "24 heures. Vos contacts voient la boutique sans que vous écriviez un par un.",
    doneLabel: "Status publié",
  },
  contacts: {
    title: "Envoyez à 10 personnes",
    hint: "Famille, voisins, collègues — des gens qui vous connaissent déjà.",
    doneLabel: "Messages envoyés",
  },
  qr: {
    title: "QR au comptoir",
    hint: "Montrez-le à un client présent. Il ouvre la boutique sans taper le lien.",
    doneLabel: "QR prêt",
  },
  caisse: {
    title: "Enregistrez chaque achat",
    hint: "Dès qu’un client paie, ouvrez la Caisse. Sinon Wazo ne voit pas la vente.",
    doneLabel: "Caisse ouverte",
  },
};

export default function BringClientsPage() {
  const [store, setStore] = useState(() => localStore.get());
  const [paid, setPaid] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [progress, setProgress] = useState<BringClientProgress>({
    completed: [],
    stepIndex: 0,
  });

  const storeName = store?.name || "Ma boutique";
  const url = boutiquePublicUrl(store?.slug);
  const shareText = url ? boutiqueShareText(storeName, url) : "";
  const stepId = BRING_STEP_IDS[progress.stepIndex] ?? "link";
  const copy = STEP_COPY[stepId];
  const doneCount = BRING_STEP_IDS.filter((id) => progress.completed.includes(id)).length;
  const allDone = doneCount === BRING_STEP_IDS.length;

  useEffect(() => {
    const refresh = () => setStore(localStore.get());
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  useEffect(() => {
    setProgress(readBringClientProgress(store?.id));
  }, [store?.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/api/billing/subscription", { cache: "no-store" });
        const data = (await res.json()) as {
          success?: boolean;
          subscription?: BillingSubscription;
        };
        if (!cancelled && res.ok && data.success) {
          setPaid(isPaidSubscriber(data.subscription));
        }
      } catch {
        /* hors ligne : on n’affiche pas le nag */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!url) {
      setQrDataUrl("");
      return;
    }
    void QRCode.toDataURL(url, { width: 220, margin: 2 }).then(setQrDataUrl);
  }, [url]);

  function persist(next: BringClientProgress) {
    setProgress(next);
    writeBringClientProgress(store?.id, next);
  }

  function goTo(index: number) {
    persist({
      ...progress,
      stepIndex: Math.min(BRING_STEP_IDS.length - 1, Math.max(0, index)),
    });
  }

  function completeCurrent() {
    persist(markBringStepDone(progress, stepId));
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
        /* cancelled */
      }
    }
    window.open(buildWhatsAppShareUrl(shareText), "_blank", "noopener,noreferrer");
  }

  const waHref = useMemo(
    () => (shareText ? buildWhatsAppShareUrl(shareText) : "#"),
    [shareText]
  );

  const linkActions = url ? (
    <div className="space-y-3">
      <p className="break-all rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-800">{url}</p>
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
    </div>
  ) : null;

  const whatsAppButton = (label: string) => (
    <a
      href={waHref}
      target="_blank"
      rel="noreferrer"
      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] text-sm font-semibold text-white"
    >
      <MessageCircle className="h-4 w-4" />
      {label}
    </a>
  );

  const qrBlock = (
    <div className="space-y-2 text-center">
      {qrDataUrl ? (
        <img
          src={qrDataUrl}
          alt="QR boutique"
          width={176}
          height={176}
          className="mx-auto h-44 w-44 rounded-xl border border-gray-100"
        />
      ) : null}
      <p className="text-xs text-gray-500">Enregistrez la capture dans votre galerie.</p>
    </div>
  );

  const missingSlug = (
    <section className="app-card p-4 text-sm text-amber-800">
      Votre boutique n&apos;a pas encore de lien public. Terminez la configuration, puis revenez ici.
      <Button asChild className="mt-3 w-full" variant="outline">
        <Link href="/setup">Ouvrir la configuration</Link>
      </Button>
    </section>
  );

  return (
    <>
      <AppHeader title="Amener des clients" subtitle="Commerce" />
      <main className="app-page space-y-4 pb-6">
        {paid ? (
          <>
            <section className="app-card p-4">
              <p className="text-sm font-semibold text-gray-900">Outils de partage</p>
              <p className="mt-1 text-xs text-gray-600">
                Rien n&apos;est obligatoire. Prenez seulement ce dont vous avez besoin.
              </p>
            </section>
            {!url ? (
              missingSlug
            ) : (
              <div className="space-y-3">
                <section className="app-card space-y-3 p-4">
                  <h2 className="text-sm font-bold text-gray-900">Lien boutique</h2>
                  {linkActions}
                </section>
                <section className="app-card space-y-3 p-4">
                  <h2 className="text-sm font-bold text-gray-900">WhatsApp</h2>
                  {whatsAppButton("Ouvrir WhatsApp")}
                </section>
                <section className="app-card space-y-3 p-4">
                  <h2 className="text-sm font-bold text-gray-900">QR au comptoir</h2>
                  {qrBlock}
                </section>
              </div>
            )}
          </>
        ) : (
          <>
            <section className="app-card border-[#FF6F00]/25 bg-gradient-to-br from-white to-[#FFF5EB] p-4">
              <p className="text-sm font-semibold text-gray-900">
                Wazo enregistre les ventes. C&apos;est vous qui amenez les clients.
              </p>
              <p className="mt-1 text-xs text-gray-600">
                {allDone
                  ? "Parcours terminé. Revenez quand vous voulez."
                  : `Étape ${progress.stepIndex + 1} sur ${BRING_STEP_IDS.length} — ${doneCount} faite(s).`}
              </p>
            </section>

            <div className="flex gap-1.5">
              {BRING_STEP_IDS.map((id, index) => {
                const done = progress.completed.includes(id);
                const current = index === progress.stepIndex;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => goTo(index)}
                    className={`h-1.5 flex-1 rounded-full ${
                      current ? "bg-[#FF6F00]" : done ? "bg-wazo-green" : "bg-gray-200"
                    }`}
                    aria-label={`Étape ${index + 1}`}
                  />
                );
              })}
            </div>

            {!url ? (
              missingSlug
            ) : (
              <section className="app-card space-y-4 p-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                    Étape {progress.stepIndex + 1} / {BRING_STEP_IDS.length}
                  </p>
                  <h2 className="mt-1 text-base font-extrabold text-gray-900">{copy.title}</h2>
                  <p className="mt-1 text-sm text-gray-600">{copy.hint}</p>
                </div>

                {stepId === "link" ? linkActions : null}
                {stepId === "status" ? whatsAppButton("Ouvrir WhatsApp — Status") : null}
                {stepId === "contacts" ? whatsAppButton("Ouvrir WhatsApp — contacts") : null}
                {stepId === "qr" ? qrBlock : null}
                {stepId === "caisse" ? (
                  <Button asChild className="w-full">
                    <Link href="/sales">Ouvrir la caisse</Link>
                  </Button>
                ) : null}

                {progress.completed.includes(stepId) ? (
                  <p className="flex items-center gap-2 text-xs font-medium text-wazo-green">
                    <Check className="h-3.5 w-3.5" />
                    Étape déjà faite
                  </p>
                ) : null}

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    disabled={progress.stepIndex === 0}
                    onClick={() => goTo(progress.stepIndex - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Retour
                  </Button>
                  {progress.stepIndex < BRING_STEP_IDS.length - 1 ? (
                    <Button type="button" className="flex-1" onClick={completeCurrent}>
                      {copy.doneLabel}
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button type="button" className="flex-1" onClick={completeCurrent}>
                      {allDone ? "Terminé" : copy.doneLabel}
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </section>
            )}

            {allDone ? (
              <section className="app-card border-wazo-green/20 p-4">
                <p className="text-sm font-semibold text-wazo-green">Bravo — le parcours est complet.</p>
                <p className="mt-1 text-xs text-gray-600">
                  Continuez à partager le lien, et enregistrez chaque vente à la caisse.
                </p>
              </section>
            ) : null}
          </>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Button asChild variant="outline">
            <Link href="/sales">Caisse</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/clients">Mini CRM</Link>
          </Button>
        </div>
      </main>
    </>
  );
}
