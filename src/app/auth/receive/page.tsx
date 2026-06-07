"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { localAuth } from "@/lib/db";
import { mapErrorToUserMessage } from "@/lib/user-messages";
import { getLandingLoginUrl } from "@/lib/public-urls";
import { applyPendingModule } from "@/lib/modules/preference";

function readTokensFromHash(): { accessToken: string; refreshToken: string } | null {
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const params = new URLSearchParams(hash);
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export default function AuthReceivePage() {
  const [status, setStatus] = useState("Connexion en cours...");
  const [error, setError] = useState("");
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const goDashboard = () => {
      window.history.replaceState(null, "", "/dashboard");
      window.location.replace("/dashboard");
    };

    const run = async () => {
      const tokens = readTokensFromHash();

      if (tokens) {
        const { data, error: sessionError } = await supabase.auth.setSession({
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
        });

        if (!sessionError && data.session?.user) {
          localAuth.saveSession(data.session.access_token, {
            id: data.session.user.id,
            phone: data.session.user.phone,
          });
          applyPendingModule();
          goDashboard();
          return;
        }

        const { data: retry } = await supabase.auth.getSession();
        if (retry.session?.user) {
          goDashboard();
          return;
        }

        setStatus("Connexion impossible");
        setError(
          sessionError
            ? mapErrorToUserMessage(sessionError, "Impossible de finaliser votre connexion.")
            : "Impossible de finaliser votre connexion."
        );
        return;
      }

      const { data: existing } = await supabase.auth.getSession();
      if (existing.session?.user) {
        goDashboard();
        return;
      }

      setStatus("Lien invalide");
      setError("Lien de connexion invalide (tokens absents dans l'URL).");
    };

    void run().catch((err) => {
      setStatus("Connexion impossible");
      setError(mapErrorToUserMessage(err, "Impossible de finaliser votre connexion."));
    });
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-wazo-cream px-4">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center text-wazo-green">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-wazo-green border-t-transparent" />
        <p className="text-sm font-medium">{status}</p>
        {error && (
          <>
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
            <a
              href={getLandingLoginUrl()}
              className="rounded-full bg-[#FF6F00] px-5 py-2 text-xs font-semibold text-white"
            >
              Retour a la connexion
            </a>
          </>
        )}
      </div>
    </div>
  );
}
