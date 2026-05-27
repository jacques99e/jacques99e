"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/contexts/I18nContext";
import { ModuleCard } from "@/components/ModuleCard";
import { languages } from "@/i18n";
import { localModules } from "@/lib/db";
import { ALL_MODULE_IDS } from "@/lib/modules/config";
import type { Language, ModuleId } from "@/types";

export default function RegisterPage() {
  const { t, setLang } = useI18n();
  const { user, supabase } = useAuth();
  const router = useRouter();
  const [shopName, setShopName] = useState("");
  const [language, setLanguage] = useState<Language>("fr");
  const [selectedModules, setSelectedModules] = useState<ModuleId[]>(["commerce"]);
  const [loading, setLoading] = useState(false);

  const toggleModule = (id: ModuleId) => {
    setSelectedModules((prev) => {
      const next = prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id];
      return next.length ? next : ["commerce"];
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      router.push("/login");
      return;
    }
    setLoading(true);
    try {
      localModules.save(selectedModules);
      await supabase.from("profiles").upsert({
        id: user.id,
        phone: user.phone,
        full_name: shopName,
        preferred_language: language,
        active_modules: selectedModules,
      });
      setLang(language);
      router.push("/setup");
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
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t("common.loading") : t("setup.continue")}
          </Button>
        </form>
      </div>
    </div>
  );
}
