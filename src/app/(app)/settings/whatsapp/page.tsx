"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2, MessageCircle } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";

interface WhatsAppStatus {
  simulate: boolean;
  provider: string;
  configured: boolean;
  hasTemplate: boolean;
}

export default function WhatsAppSettingsPage() {
  const { user } = useAuth();
  const { canManageSettings, role } = useRole(user?.id);
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const res = await apiFetch("/api/whatsapp/status");
        const json = (await res.json()) as WhatsAppStatus & {
          success?: boolean;
          error?: string;
        };
        if (!res.ok) throw new Error(json.error || "Impossible de lire le statut");
        setStatus(json);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const sendTest = async () => {
    setSending(true);
    setNotice("");
    setError("");
    try {
      const res = await apiFetch("/api/whatsapp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const json = (await res.json()) as {
        success: boolean;
        message?: string;
        error?: string;
      };
      if (!res.ok || !json.success) throw new Error(json.error || "Échec envoi");
      setNotice(json.message || "Message envoyé");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <AppHeader title="WhatsApp Business" subtitle="Paramètres" />
      <main className="app-page pb-6">
        {!canManageSettings ? (
          <section className="app-card border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Accès réservé au propriétaire (rôle : {role}).
          </section>
        ) : null}

        <section className="app-card p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="rounded-xl bg-[#075E54]/10 p-2.5 text-[#075E54]">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">Envoi automatique</p>
              <p className="text-xs text-gray-500">
                COD vendeur, relances CRM, actions du jour
              </p>
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-gray-500">Chargement...</p>
          ) : status ? (
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between rounded-lg bg-gray-50 px-3 py-2">
                <span>Mode</span>
                <span className="font-medium">
                  {status.simulate
                    ? "Simulation (pas d'envoi réel)"
                    : "Production"}
                </span>
              </li>
              <li className="flex justify-between rounded-lg bg-gray-50 px-3 py-2">
                <span>Fournisseur</span>
                <span className="font-medium uppercase">{status.provider}</span>
              </li>
              <li className="flex justify-between rounded-lg bg-gray-50 px-3 py-2">
                <span>Configuration</span>
                <span
                  className={
                    status.configured
                      ? "font-medium text-green-700"
                      : "font-medium text-red-600"
                  }
                >
                  {status.configured ? "OK" : "Incomplète"}
                </span>
              </li>
              <li className="flex justify-between rounded-lg bg-gray-50 px-3 py-2">
                <span>Modèle Meta</span>
                <span className="font-medium">
                  {status.hasTemplate ? "Configuré" : "Non (texte 24 h)"}
                </span>
              </li>
            </ul>
          ) : null}

          {!loading && status && !status.configured ? (
            <p className="mt-3 text-xs text-amber-800">
              Sans API, l’app ouvre toujours wa.me. Configurez Meta Cloud API
              (recommandé) ou Twilio sur Vercel.
            </p>
          ) : null}
        </section>

        {canManageSettings ? (
          <section className="app-card space-y-3 p-4">
            <p className="text-sm font-semibold">Envoyer un message test</p>
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+223 70 00 00 00"
            />
            {error ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </p>
            ) : null}
            {notice ? (
              <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
                {notice}
              </p>
            ) : null}
            <Button
              className="w-full"
              disabled={sending || !phone.trim()}
              onClick={() => void sendTest()}
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {sending ? "Envoi..." : "Tester l'envoi WhatsApp"}
            </Button>
            <p className="text-xs text-gray-500">
              Meta : WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID,
              WHATSAPP_VERIFY_TOKEN. Optionnel : WHATSAPP_TEMPLATE_NAME (hors
              fenêtre 24 h). Twilio : WHATSAPP_PROVIDER=twilio +
              TWILIO_WHATSAPP_FROM.
            </p>
          </section>
        ) : null}

        <Link
          href="/settings"
          className="block text-center text-xs text-gray-500 hover:text-wazo-green"
        >
          ← Retour paramètres
        </Link>
      </main>
    </>
  );
}
