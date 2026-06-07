"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2, MessageSquare } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";

interface SmsStatus {
  simulate: boolean;
  provider: string;
  configured: boolean;
}

export default function SmsSettingsPage() {
  const { user } = useAuth();
  const { canManageSettings, role } = useRole(user?.id);
  const [status, setStatus] = useState<SmsStatus | null>(null);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const res = await apiFetch("/api/sms/status");
        const json = (await res.json()) as SmsStatus & { success?: boolean; error?: string };
        if (!res.ok) throw new Error(json.error || "Impossible de lire le statut SMS");
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
      const res = await apiFetch("/api/sms/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const json = (await res.json()) as { success: boolean; message?: string; error?: string };
      if (!res.ok || !json.success) throw new Error(json.error || "Échec envoi");
      setNotice(json.message || "SMS envoyé");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <AppHeader title="SMS" subtitle="Paramètres" />
      <main className="app-page pb-6">
        {!canManageSettings ? (
          <section className="app-card border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Accès réservé au propriétaire (rôle : {role}).
          </section>
        ) : null}

        <section className="app-card p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="rounded-xl bg-wazo-green/10 p-2.5 text-wazo-green">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">Invitations & notifications</p>
              <p className="text-xs text-gray-500">
                Formation, livraisons, rappels santé
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
                  {status.simulate ? "Simulation (pas d'envoi réel)" : "Production"}
                </span>
              </li>
              <li className="flex justify-between rounded-lg bg-gray-50 px-3 py-2">
                <span>Fournisseur</span>
                <span className="font-medium uppercase">{status.provider}</span>
              </li>
              <li className="flex justify-between rounded-lg bg-gray-50 px-3 py-2">
                <span>Configuration</span>
                <span className={status.configured ? "font-medium text-green-700" : "font-medium text-red-600"}>
                  {status.configured ? "OK" : "Incomplète"}
                </span>
              </li>
            </ul>
          ) : null}
        </section>

        {canManageSettings ? (
          <section className="app-card space-y-3 p-4">
            <p className="text-sm font-semibold">Envoyer un SMS test</p>
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+228 90 00 00 00"
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
            <Button className="w-full" disabled={sending || !phone.trim()} onClick={() => void sendTest()}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {sending ? "Envoi..." : "Tester l'envoi SMS"}
            </Button>
            <p className="text-xs text-gray-500">
              Variables Vercel : SMS_SIMULATE, SMS_PROVIDER, TWILIO_* ou AT_API_KEY / AT_USERNAME.
            </p>
          </section>
        ) : null}

        <Link href="/settings" className="block text-center text-xs text-gray-500 hover:text-wazo-green">
          ← Retour paramètres
        </Link>
      </main>
    </>
  );
}
