"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Lock, Mail } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { localAuth } from "@/lib/db";
import { getLandingRegisterUrl } from "@/lib/public-urls";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    searchParams.get("error") ? "Connexion Google interrompue. Réessayez." : null
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session?.user) {
        localAuth.saveSession(data.session.access_token, {
          id: data.session.user.id,
          phone: data.session.user.phone,
        });
        router.replace("/dashboard");
        return;
      }
      setCheckingSession(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMessage("Email ou mot de passe incorrect.");
        return;
      }

      if (data.session?.user) {
        localAuth.saveSession(data.session.access_token, {
          id: data.session.user.id,
          phone: data.session.user.phone,
        });
      }

      router.replace("/dashboard");
    } catch {
      setErrorMessage("Impossible de se connecter pour le moment.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGoogle() {
    setErrorMessage(null);
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        setErrorMessage("Connexion Google indisponible.");
        setIsLoading(false);
      }
    } catch {
      setErrorMessage("Connexion Google indisponible.");
      setIsLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#FFF8F0]">
        <Loader2 className="h-6 w-6 animate-spin text-[#075E54]" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#FFF8F0] px-4 py-8">
      <div className="mx-auto w-full max-w-md">
        <section className="rounded-2xl border border-[#075E54]/10 bg-white p-6 shadow-sm md:p-8">
          <h1 className="text-2xl font-bold text-[#1A1A1A]">Connexion</h1>
          <p className="mt-2 text-sm text-[#1A1A1A]/75">
            Accédez à votre espace Wazo Digital sans quitter l’application.
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleLogin}>
            <label className="block text-sm font-medium text-[#1A1A1A]">
              Adresse email
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-[#075E54]/20 px-3 py-2">
                <Mail className="h-4 w-4 text-[#075E54]" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="email@wazo.africa"
                  required
                  autoComplete="email"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-[#1A1A1A]/45"
                />
              </div>
            </label>

            <label className="block text-sm font-medium text-[#1A1A1A]">
              Mot de passe
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-[#075E54]/20 px-3 py-2">
                <Lock className="h-4 w-4 text-[#075E54]" />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  autoComplete="current-password"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-[#1A1A1A]/45"
                />
              </div>
            </label>

            {errorMessage ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {errorMessage}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#FF6F00] px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Connexion...
                </>
              ) : (
                "Se connecter"
              )}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-[#075E54]/10" />
            <span className="text-xs text-[#1A1A1A]/50">ou</span>
            <span className="h-px flex-1 bg-[#075E54]/10" />
          </div>

          <button
            type="button"
            onClick={() => void handleGoogle()}
            disabled={isLoading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#075E54]/20 bg-white px-5 py-2.5 text-sm font-semibold text-[#1A1A1A] transition hover:bg-[#075E54]/5 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
            Continuer avec Google
          </button>

          <p className="mt-4 text-center text-sm text-[#1A1A1A]/75">
            Pas encore de compte ?{" "}
            <a href={getLandingRegisterUrl()} className="font-semibold text-[#075E54] hover:underline">
              Créer un compte
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#FFF8F0]">
          <Loader2 className="h-6 w-6 animate-spin text-[#075E54]" />
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
