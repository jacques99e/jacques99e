"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/contexts/I18nContext";

export default function LoginPage() {
  const { t } = useI18n();
  const { user, supabase } = useAuth();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [formattedPhone, setFormattedPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [offlineInfo, setOfflineInfo] = useState("");

  if (user) {
    router.replace("/dashboard");
    return null;
  }

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setOfflineInfo("");
    setStep("otp");
    setLoading(true);
    try {
      const formatted = phone.startsWith("+") ? phone : `+${phone}`;
      setFormattedPhone(formatted);
      const { error: otpError } = await supabase.auth.signInWithOtp({ phone: formatted });
      if (otpError) throw otpError;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Impossible d'envoyer le code OTP";
      setError(message);
      setOfflineInfo("Mode hors ligne - données locales");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setError("");
    setOfflineInfo("");
    if (!formattedPhone) {
      setError("Numéro de téléphone invalide");
      return;
    }
    setLoading(true);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: otp,
        type: "sms",
      });
      if (verifyError) throw verifyError;
      router.push("/dashboard");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Code OTP invalide";
      setError(message);
      if (!navigator.onLine) {
        setOfflineInfo("Mode hors ligne - données locales");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-wazo-green">
      <div className="flex flex-1 flex-col justify-center px-6 py-12">
        <div className="mx-auto w-full max-w-sm space-y-6">
          <div className="text-center text-white">
            <h1 className="text-2xl font-bold">{t("app.name")}</h1>
            <p className="mt-1 text-sm text-white/80">{t("app.tagline")}</p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-lg">
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <Label htmlFor="phone">{t("auth.phone")}</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t("auth.phonePlaceholder")}
                  required
                  className="mt-1"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? t("common.loading") : t("auth.sendOtp")}
              </Button>

              {step === "otp" && (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="otp">{t("auth.otp")}</Label>
                    <div className="mt-1 flex items-center gap-2">
                      <Input
                        id="otp"
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        placeholder="Entrez le code reçu"
                        className="text-center text-lg tracking-widest"
                      />
                      <Button type="button" onClick={() => void handleVerify()} disabled={loading || otp.length < 6}>
                        Vérifier le code
                      </Button>
                    </div>
                  </div>
                  {error && <p className="text-sm text-red-600">{error}</p>}
                </div>
              )}

              <p className="text-center text-xs text-gray-500">
                Code de test : utilise le code reçu dans la console Supabase
              </p>
              {offlineInfo && <p className="text-center text-xs text-orange-600">{offlineInfo}</p>}
              {step === "otp" && (
                <button
                  type="button"
                  className="w-full text-sm text-wazo-green"
                  onClick={() => {
                    setStep("phone");
                    setOtp("");
                    setError("");
                  }}
                >
                  {t("common.back")}
                </button>
              )}
            </form>

            <p className="mt-4 text-center text-sm text-gray-500">
              <Link href="/register" className="text-wazo-green font-medium">
                {t("auth.register")}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
