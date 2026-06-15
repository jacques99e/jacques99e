"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { localStore } from "@/lib/db";
import { mapErrorToUserMessage } from "@/lib/user-messages";

type CheckState = "idle" | "ok" | "error";

interface CheckResult {
  state: CheckState;
  message: string;
}

interface ApiTestResult {
  path: string;
  status: number | null;
  ok: boolean;
  detail: string;
}

const defaultResult: CheckResult = {
  state: "idle",
  message: "Pas encore verifie.",
};

export default function SettingsPage() {
  const { user } = useAuth();
  const { canManageSettings, role } = useRole(user?.id);
  const [running, setRunning] = useState(false);
  const [envCheck, setEnvCheck] = useState<CheckResult>(defaultResult);
  const [authCheck, setAuthCheck] = useState<CheckResult>(defaultResult);
  const [dbCheck, setDbCheck] = useState<CheckResult>(defaultResult);
  const [storeId, setStoreId] = useState("");
  const [apiRunning, setApiRunning] = useState(false);
  const [apiResults, setApiResults] = useState<ApiTestResult[]>([]);
  const [apiSummary, setApiSummary] = useState<CheckResult>(defaultResult);
  const [lastRun, setLastRun] = useState<string>("");

  const runChecks = useCallback(async () => {
    setRunning(true);

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
      setEnvCheck({
        state: "error",
        message: "Variables Supabase manquantes: NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY",
      });
      setAuthCheck({
        state: "error",
        message: "Test ignore: variables d'environnement manquantes.",
      });
      setDbCheck({
        state: "error",
        message: "Test ignore: variables d'environnement manquantes.",
      });
      setLastRun(new Date().toLocaleString("fr-FR"));
      setRunning(false);
      return;
    }

    setEnvCheck({
      state: "ok",
      message: "Variables Supabase detectees.",
    });

    const supabase = createClient(url, anonKey);

    try {
      const { error } = await supabase.auth.getSession();
      if (error) throw error;
      setAuthCheck({
        state: "ok",
        message: "Connexion Auth Supabase OK.",
      });
    } catch (error) {
      const message = mapErrorToUserMessage(error, "Connexion Auth Supabase indisponible.");
      setAuthCheck({
        state: "error",
        message: `Echec Auth Supabase: ${message}`,
      });
    }

    try {
      const { error } = await supabase
        .from("stores")
        .select("id")
        .limit(1);

      if (error) throw error;

      setDbCheck({
        state: "ok",
        message: "Connexion base de donnees Supabase OK.",
      });
    } catch (error) {
      const message = mapErrorToUserMessage(error, "Connexion base de donnees indisponible.");
      setDbCheck({
        state: "error",
        message: `Echec acces table stores: ${message}`,
      });
    }

    setLastRun(new Date().toLocaleString("fr-FR"));
    setRunning(false);
  }, []);

  useEffect(() => {
    void runChecks();
  }, [runChecks]);

  useEffect(() => {
    const store = localStore.get();
    if (store?.id) setStoreId(store.id);
  }, []);

  const runApiTests = useCallback(
    async (mode: "authenticated" | "anonymous") => {
      if (!storeId.trim()) {
        setApiSummary({
          state: "error",
          message: "Renseigne un store_id pour lancer les tests API.",
        });
        setApiResults([]);
        return;
      }

      const store = encodeURIComponent(storeId.trim());
      const tests = [
        {
          path: `/api/education/courses?store_id=${store}`,
          expected: mode === "authenticated" ? 200 : 401,
        },
        {
          path: `/api/logistics/deliveries?store_id=${store}`,
          expected: mode === "authenticated" ? 200 : 401,
        },
        {
          path: `/api/blockchain/assets?store_id=${store}`,
          expected: mode === "authenticated" ? 200 : 401,
        },
      ];

      setApiRunning(true);
      setApiResults([]);
      setApiSummary({ state: "idle", message: "Tests API en cours..." });

      const results = await Promise.all(
        tests.map(async (test): Promise<ApiTestResult> => {
          try {
            const response = await fetch(test.path, {
              method: "GET",
              credentials: mode === "authenticated" ? "include" : "omit",
            });
            const ok = response.status === test.expected;
            return {
              path: test.path,
              status: response.status,
              ok,
              detail: ok
                ? `OK (${response.status})`
                : `Attendu ${test.expected}, recu ${response.status}`,
            };
          } catch (error) {
            const message = mapErrorToUserMessage(
              error,
              "Erreur reseau lors du test. Reessayez."
            );
            return {
              path: test.path,
              status: null,
              ok: false,
              detail: message,
            };
          }
        })
      );

      setApiResults(results);
      const hasError = results.some((result) => !result.ok);
      setApiSummary({
        state: hasError ? "error" : "ok",
        message: hasError
          ? "Certains tests API ont echoue. Regarde le detail ci-dessous."
          : `Tous les tests API (${mode === "authenticated" ? "connecte" : "anonyme"}) sont OK.`,
      });
      setApiRunning(false);
    },
    [storeId]
  );

  const globalState: CheckState = useMemo(() => {
    const states = [envCheck.state, authCheck.state, dbCheck.state];
    if (states.includes("error")) return "error";
    if (states.every((state) => state === "ok")) return "ok";
    return "idle";
  }, [envCheck.state, authCheck.state, dbCheck.state]);

  const statusPillClass =
    globalState === "ok"
      ? "bg-green-100 text-green-700"
      : globalState === "error"
        ? "bg-red-100 text-red-700"
        : "bg-gray-100 text-gray-700";

  return (
    <>
      <AppHeader title="Diagnostic" subtitle="Paramètres" />
      <main className="app-page pb-6">
        {!canManageSettings ? (
          <section className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
            Accès limité pour le rôle <strong>{role}</strong>. Les diagnostics sont réservés au propriétaire.
          </section>
        ) : (
          <>
            <Link
              href="/settings/stores/new"
              className="block rounded-xl bg-[#075E54]/10 p-4 text-sm font-medium text-[#075E54]"
            >
              Nouvelle boutique (multi-sites) →
            </Link>
            <Link
              href="/settings/business"
              className="block rounded-xl bg-[#075E54]/10 p-4 text-sm font-medium text-[#075E54]"
            >
              Paramètres métier (seuils stock, objectif CA, modèles WhatsApp) →
            </Link>
            <Link
              href="/settings/notifications"
              className="block rounded-xl bg-[#075E54]/10 p-4 text-sm font-medium text-[#075E54]"
            >
              Notifications, sync cloud & rapport e-mail →
            </Link>
            <Link
              href="/settings/team"
              className="block rounded-xl bg-[#075E54]/10 p-4 text-sm font-medium text-[#075E54]"
            >
              Équipe & rôles →
            </Link>
            <Link
              href="/settings/sms"
              className="block rounded-xl bg-wazo-orange/10 p-4 text-sm font-medium text-wazo-orange"
            >
              SMS (formation, livraisons, santé) →
            </Link>
          </>
        )}
        <section className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium dark:text-white">Etat general</p>
            <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusPillClass}`}>
              {globalState === "ok" ? "OK" : globalState === "error" ? "ERREUR" : "EN ATTENTE"}
            </span>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            {typeof navigator !== "undefined" && navigator.onLine ? "En ligne" : "Hors ligne"}
          </p>
          {lastRun && <p className="mt-1 text-xs text-gray-500">Dernier test: {lastRun}</p>}
        </section>

        <section className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800 space-y-3">
          <HealthRow title="Variables d'environnement" result={envCheck} />
          <HealthRow title="Supabase Auth" result={authCheck} />
          <HealthRow title="Supabase Database (stores)" result={dbCheck} />
        </section>

        <Button
          onClick={() => void runChecks()}
          disabled={running || !canManageSettings}
          className="w-full bg-[#075E54] hover:opacity-90"
        >
          {running ? "Verification..." : "Relancer les verifications"}
        </Button>

        <section className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800 space-y-3">
          <p className="text-sm font-medium dark:text-white">Diagnostic API</p>
          <p className="text-xs text-gray-600 dark:text-gray-300">
            Teste automatiquement les endpoints proteges sans ouvrir la console.
          </p>
          <Input
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            placeholder="store_id"
            disabled={!canManageSettings}
          />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button
              onClick={() => void runApiTests("authenticated")}
              disabled={apiRunning || !canManageSettings}
            >
              {apiRunning ? "Test en cours..." : "Tester API connecte"}
            </Button>
            <Button
              variant="outline"
              onClick={() => void runApiTests("anonymous")}
              disabled={apiRunning || !canManageSettings}
            >
              Tester protection anonyme
            </Button>
          </div>
          <HealthRow title="Resultat global API" result={apiSummary} />
          {apiResults.length ? (
            <div className="space-y-2">
              {apiResults.map((result) => (
                <div
                  key={result.path}
                  className="rounded-lg border border-gray-100 p-2 text-xs dark:border-gray-700"
                >
                  <p className="font-medium break-all">{result.path}</p>
                  <p className={result.ok ? "text-green-700" : "text-red-700"}>{result.detail}</p>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      </main>
    </>
  );
}

function HealthRow({ title, result }: { title: string; result: CheckResult }) {
  const dotClass =
    result.state === "ok"
      ? "bg-green-500"
      : result.state === "error"
        ? "bg-red-500"
        : "bg-gray-300";

  return (
    <div className="rounded-lg border border-gray-100 p-3 dark:border-gray-700">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} />
        <p className="text-sm font-medium dark:text-white">{title}</p>
      </div>
      <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{result.message}</p>
    </div>
  );
}
