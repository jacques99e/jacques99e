"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/contexts/I18nContext";
import { ModuleCard } from "@/components/ModuleCard";
import { languages } from "@/i18n";
import { localModules } from "@/lib/db";
import { ALL_MODULE_IDS, normalizeModuleIds } from "@/lib/modules/config";
import { savePendingModule } from "@/lib/modules/preference";
import { getLandingRegisterUrl } from "@/lib/public-urls";
import { ensureUserProfile } from "@/lib/ensure-profile";
import { setBusinessVertical } from "@/lib/onboarding";
import type { Language, ModuleId } from "@/types";

function RegisterForm() {
  const { t, setLang } = useI18n();
  const { user, supabase } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [shopName, setShopName] = useState("");
  const [language, setLanguage] = useState<Language>("fr");
  const [selectedModules, setSelectedModules] = useState<ModuleId[]>(() => localModules.get());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fromUrl = searchParams.get("module");
    if (!fromUrl) return;
    savePendingModule(fromUrl);
    setSelectedModules(normalizeModuleIds([fromUrl]));
  }, [searchParams]);

  const toggleModule = (id: ModuleId) => {
    setSelectedModules((prev) => {
      const next = prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id];
      return next.length ? next : ["commerce"];
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      window.location.href = getLandingRegisterUrl();
      return;
    }
    setLoading(true);
    setError("");
    try {
      const modules = normalizeModuleIds(selectedModules);
      localModules.save(modules);
      setBusinessVertical(modules[0]);
      const profileResult = await ensureUserProfile(supabase, user.id, user.phone);
      if (!profileResult.ok) {
        setError(profileResult.error);
        return;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          full_name: shopName,
          language,
          active_modules: modules,
        })
        .eq("id", user.id);
      if (updateError) throw updateError;

      setLang(language);
      router.push("/setup");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Impossible d'enregistrer votre profil pour le moment."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-wazo-cream px-4 py-8">
      <div className="mx-auto max-w-sm space-y-6">
        <h1 className="text-xl font-bold text-wazo-green">{t("auth.register")}</h1>
        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl bg-white p-6 shadow">
          {user?.phone && (
            <div>
              <Label>{t("auth.phone")}</Label>
              <Input value={user.phone} readOnly className="mt-1 bg-gray-50" />
            </div>
          )}
          <div>
            <Label>{t("auth.shopName")}</Label>
            <Input
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              required
              className="mt-1"
            />
          </div>
          <div className="space-y-2">
            <Label>{t("modules.title")}</Label>
            {ALL_MODULE_IDS.map((id) => (
              <ModuleCard
                key={id}
                moduleId={id}
                enabled={selectedModules.includes(id)}
                onToggle={toggleModule}
              />
            ))}
          </div>
          <div>
            <Label>{t("auth.language")}</Label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className="mt-1 flex h-11 w-full rounded-lg border border-gray-200 px-3"
            >
              {languages.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t("common.loading") : t("setup.continue")}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-wazo-cream">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-wazo-green border-t-transparent" />
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
