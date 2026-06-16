"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActiveStore } from "@/hooks/useActiveStore";
import { useAuth } from "@/hooks/useAuth";
import { useBilling } from "@/hooks/useBilling";
import { useRole } from "@/hooks/useRole";
import { billingPayHref } from "@/lib/billing-checkout";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { apiFetch } from "@/lib/api-client";
import { sendSelfPushTest } from "@/lib/push-client";
import {
  formatLegacySyncSummary,
  syncAllLegacyModulesToCloud,
} from "@/lib/legacy-module-sync";

export default function NotificationsSettingsPage() {
  const { user } = useAuth();
  const { activeStore } = useActiveStore();
  const { canManageSettings } = useRole(user?.id, activeStore?.membership_role);
  const { canUseWeeklyEmail, loading: billingLoading } = useBilling();
  const { supported, enabled, loading, enable, disable } = usePushNotifications(
    activeStore?.id
  );
  const [email, setEmail] = useState("");
  const [reportEnabled, setReportEnabled] = useState(true);
  const [saved, setSaved] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState("");

  const load = useCallback(async () => {
    if (!activeStore?.id) return;
    const res = await apiFetch(`/api/reports/settings?store_id=${activeStore.id}`);
    const data = (await res.json()) as {
      success: boolean;
      settings?: { email: string; enabled: boolean };
    };
    if (data.settings) {
      setEmail(data.settings.email);
      setReportEnabled(data.settings.enabled);
    }
  }, [activeStore?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveEmail = async () => {
    if (!activeStore?.id || !email.trim()) return;
    setEmailError("");
    const res = await apiFetch("/api/reports/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        store_id: activeStore.id,
        email: email.trim(),
        enabled: reportEnabled,
      }),
    });
    const data = (await res.json()) as { success?: boolean; error?: string };
    if (res.ok && data.success !== false) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } else {
      setEmailError(data.error || "Impossible d'enregistrer l'e-mail.");
    }
  };

  const sendTestReport = async () => {
    if (!activeStore?.id || !email.trim()) {
      setTestResult("Enregistrez d'abord une adresse e-mail.");
      return;
    }
    setTestSending(true);
    setTestResult("");
    try {
      const res = await apiFetch("/api/reports/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ store_id: activeStore.id, email: email.trim() }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string; email?: string };
      if (res.ok && data.success) {
        setTestResult(`Rapport test envoyé à ${data.email || email}.`);
      } else {
        setTestResult(data.error || "Échec d'envoi — vérifiez RESEND_API_KEY sur Vercel.");
      }
    } finally {
      setTestSending(false);
    }
  };

  const runSync = async () => {
    if (!activeStore?.id) return;
    setSyncing(true);
    setSyncResult("");
    try {
      const result = await syncAllLegacyModulesToCloud(activeStore.id);
      setSyncResult(formatLegacySyncSummary(result));
    } catch (error) {
      setSyncResult(
        error instanceof Error ? error.message : "Synchronisation impossible."
      );
    } finally {
      setSyncing(false);
    }
  };

  if (!canManageSettings) {
    return (
      <>
        <AppHeader title="Notifications" />
        <main className="mx-auto max-w-lg p-4">
          <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
            Réservé au propriétaire ou manager.
          </p>
        </main>
      </>
    );
  }

  return (
    <>
      <AppHeader title="Notifications & sync" />
      <main className="mx-auto max-w-lg space-y-4 p-4">
        <section className="rounded-xl bg-white p-4 shadow-sm space-y-3 dark:bg-gray-800">
          <h2 className="text-sm font-semibold">Sync cloud Supabase</h2>
          <p className="text-xs text-gray-500">
            Envoie vers le cloud les produits, livraisons, formation, santé, agriculture,
            blockchain et CRM stockés sur cet appareil.
          </p>
          <Button
            variant="outline"
            className="w-full"
            disabled={syncing}
            onClick={() => void runSync()}
          >
            {syncing ? "Synchronisation..." : "Synchroniser maintenant"}
          </Button>
          {syncResult ? (
            <p
              className={`text-xs whitespace-pre-wrap ${
                syncResult.includes("Erreurs") ? "text-red-600" : "text-[#075E54]"
              }`}
            >
              {syncResult}
            </p>
          ) : null}
        </section>

        <section className="rounded-xl bg-white p-4 shadow-sm space-y-3 dark:bg-gray-800">
          <h2 className="text-sm font-semibold">Rapport PDF par e-mail (chaque lundi)</h2>
          {!billingLoading && !canUseWeeklyEmail ? (
            <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p>L&apos;envoi automatique du rapport par e-mail est réservé au plan BUSINESS.</p>
              <Button asChild className="bg-[#FF6F00] hover:bg-[#FF6F00]/90">
                <Link href={billingPayHref("business")}>Passer au BUSINESS</Link>
              </Button>
            </div>
          ) : (
            <>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@exemple.com"
              />
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={reportEnabled}
                  onChange={(e) => setReportEnabled(e.target.checked)}
                />
                Activer l&apos;envoi hebdomadaire (8h UTC, lundi)
              </label>
              <Button className="w-full bg-[#075E54]" onClick={() => void saveEmail()}>
                Enregistrer l&apos;e-mail
              </Button>
              <Button
                variant="outline"
                className="w-full"
                disabled={testSending || !email.trim()}
                onClick={() => void sendTestReport()}
              >
                {testSending ? "Envoi..." : "Envoyer un rapport test maintenant"}
              </Button>
              {saved ? <p className="text-xs text-green-600">Enregistré.</p> : null}
              {emailError ? <p className="text-xs text-red-600">{emailError}</p> : null}
              {testResult ? (
                <p
                  className={`text-xs ${testResult.includes("envoyé") ? "text-green-600" : "text-amber-700"}`}
                >
                  {testResult}
                </p>
              ) : null}
            </>
          )}
        </section>

        <section className="rounded-xl bg-white p-4 shadow-sm space-y-3 dark:bg-gray-800">
          <h2 className="text-sm font-semibold">Alertes push navigateur</h2>
          {!supported ? (
            <p className="text-xs text-amber-700">
              Push non disponible (configurez NEXT_PUBLIC_VAPID_PUBLIC_KEY sur Vercel).
            </p>
          ) : (
            <>
              <p className="text-xs text-gray-500">
                Alertes automatiques : stock bas, relances clients et rappels RDV (santé). Un
                rappel quotidien part aussi à 7h UTC si l&apos;app est fermée.
              </p>
              {enabled ? (
                <div className="flex flex-col gap-2">
                  <Button variant="outline" onClick={disable}>
                    Désactiver
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      activeStore?.id &&
                      void sendSelfPushTest(
                        activeStore.id,
                        "Test Wazo",
                        "Les notifications fonctionnent."
                      )
                    }
                  >
                    Tester une notification
                  </Button>
                </div>
              ) : (
                <Button
                  className="w-full bg-[#075E54]"
                  disabled={loading}
                  onClick={() => void enable()}
                >
                  {loading ? "Activation..." : "Activer les notifications"}
                </Button>
              )}
            </>
          )}
        </section>

        <Link href="/settings" className="block text-center text-xs text-gray-500">
          ← Paramètres
        </Link>
      </main>
    </>
  );
}
