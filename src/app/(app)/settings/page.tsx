"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";

type CheckState = "idle" | "ok" | "error";

interface CheckResult {
  state: CheckState;
  message: string;
}

const defaultResult: CheckResult = {
  state: "idle",
  message: "Pas encore verifie.",
};

export default function SettingsPage() {
  const [running, setRunning] = useState(false);
  const [envCheck, setEnvCheck] = useState<CheckResult>(defaultResult);
  const [authCheck, setAuthCheck] = useState<CheckResult>(defaultResult);
  const [dbCheck, setDbCheck] = useState<CheckResult>(defaultResult);
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
      const message = error instanceof Error ? error.message : "Erreur inconnue";
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
      const message = error instanceof Error ? error.message : "Erreur inconnue";
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
      <AppHeader title="Health Check" />
      <main className="mx-auto max-w-lg space-y-4 p-4">
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

        <Button onClick={() => void runChecks()} disabled={running} className="w-full bg-[#075E54] hover:opacity-90">
          {running ? "Verification..." : "Relancer les verifications"}
        </Button>
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
