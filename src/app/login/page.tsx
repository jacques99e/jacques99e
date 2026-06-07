"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, Mail, Phone } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getLandingLoginUrl } from "@/lib/public-urls";
import { mapErrorToUserMessage } from "@/lib/user-messages";

export default function LoginPage() {
  const { user, loading, sendOtp, verifyOtp } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [formattedPhone, setFormattedPhone] = useState("");
  const [token, setToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [user, loading, router]);

  async function handleSendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);
    try {
      const formatted = await sendOtp(phone);
      setFormattedPhone(formatted);
      setStep("code");
    } catch (error) {
      setErrorMessage(mapErrorToUserMessage(error, "Impossible d'envoyer le code SMS."));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleVerifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);
    try {
      await verifyOtp(formattedPhone, token.trim());
      window.location.replace("/dashboard");
    } catch (error) {
      setErrorMessage(mapErrorToUserMessage(error, "Code invalide ou expire."));
    } finally {
      setIsLoading(false);
    }
  }

  if (loading || user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-wazo-green">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
      </div>
    );
  }

  const landingLoginUrl = getLandingLoginUrl();

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-wazo-green via-wazo-green to-wazo-green-light px-4 py-8">
      <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -bottom-16 -right-16 h-48 w-48 rounded-full bg-wazo-orange/20" />

      <div className="relative w-full max-w-md rounded-3xl border border-white/20 bg-white p-6 shadow-wazo-lg md:p-8">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-wazo-green/10 text-2xl">
          📱
        </div>
        <h1 className="text-center text-2xl font-bold text-gray-900">Wazo Digital</h1>
        <p className="mt-2 text-center text-sm text-gray-500">Connectez-vous avec votre téléphone</p>

        {step === "phone" ? (
          <form className="mt-6 space-y-4" onSubmit={handleSendCode}>
            <label className="block text-base font-medium text-[#1A1A1A]">
              Numéro
              <div className="mt-2 flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3 shadow-sm focus-within:border-wazo-green focus-within:ring-2 focus-within:ring-wazo-green/15">
                <Phone className="h-5 w-5 text-wazo-green" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="90 00 00 00"
                  required
                  autoComplete="tel"
                  className="w-full bg-transparent text-lg outline-none"
                />
              </div>
            </label>

            {errorMessage && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {errorMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-xl bg-wazo-orange px-5 py-3 text-base font-bold text-white shadow-sm transition hover:brightness-105 disabled:opacity-70"
            >
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
              {isLoading ? "Envoi..." : "Recevoir code 📩"}
            </button>
          </form>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={handleVerifyCode}>
            <p className="text-center text-sm text-gray-500">Code envoyé au {formattedPhone}</p>
            <label className="block text-base font-medium text-[#1A1A1A]">
              Code reçu
              <div className="mt-2 flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3 shadow-sm focus-within:border-wazo-green focus-within:ring-2 focus-within:ring-wazo-green/15">
                <KeyRound className="h-5 w-5 text-wazo-green" />
                <input
                  type="text"
                  inputMode="numeric"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="123456"
                  required
                  autoComplete="one-time-code"
                  className="w-full bg-transparent text-2xl tracking-[0.3em] outline-none"
                />
              </div>
            </label>

            {errorMessage && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {errorMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-xl bg-wazo-green px-5 py-3 text-base font-bold text-white shadow-sm transition hover:bg-wazo-green-light disabled:opacity-70"
            >
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
              {isLoading ? "..." : "Entrer ✅"}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep("phone");
                setToken("");
                setErrorMessage(null);
              }}
              className="w-full text-center text-xs text-wazo-green underline"
            >
              Modifier le numero
            </button>
          </form>
        )}

        <details className="mt-5">
          <summary className="cursor-pointer text-center text-xs text-gray-400">Autres options</summary>
          <div className="my-3 flex items-center gap-3">
            <span className="h-px flex-1 bg-gray-200" />
            <span className="text-xs text-gray-400">ou</span>
            <span className="h-px flex-1 bg-gray-200" />
          </div>
          <a
            href={landingLoginUrl}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-wazo-green/30 px-5 py-2.5 text-sm font-semibold text-wazo-green"
          >
            <Mail className="h-4 w-4" />
            Email ou Google
          </a>
          <p className="mt-4 text-center text-sm text-gray-600">
            Pas de compte ?{" "}
            <a
              href={`${landingLoginUrl.replace(/\/login$/, "")}/register`}
              className="font-semibold text-wazo-green underline"
            >
              Créer un compte
            </a>
          </p>
        </details>
      </div>
    </main>
  );
}
