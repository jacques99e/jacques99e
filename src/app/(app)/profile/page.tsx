"use client";

import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/contexts/I18nContext";
import { useTheme } from "@/contexts/ThemeContext";
import { localStore } from "@/lib/db";
import type { Language } from "@/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Moon, Sun } from "lucide-react";

export default function ProfilePage() {
  const { t, lang, setLang, languages } = useI18n();
  const { signOut } = useAuth();
  const { dark, toggle } = useTheme();
  const router = useRouter();
  const store = localStore.get();
  const [copied, setCopied] = useState(false);

  const storefrontUrl =
    typeof window !== "undefined" && store
      ? `${window.location.origin}/boutique/${store.slug}`
      : "";

  const copyUrl = () => {
    navigator.clipboard.writeText(storefrontUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLogout = async () => {
    await signOut();
    router.replace("/login");
  };

  return (
    <>
      <AppHeader title={t("nav.profile")} />
      <main className="mx-auto max-w-lg space-y-4 p-4">
        <section className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800 space-y-3">
          <label className="text-sm font-medium dark:text-white">{t("settings.language")}</label>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as Language)}
            className="flex h-11 w-full rounded-lg border px-3 dark:bg-gray-900 dark:border-gray-600"
          >
            {languages.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </section>

        <section className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800 flex items-center justify-between">
          <span className="text-sm font-medium dark:text-white">{t("settings.darkMode")}</span>
          <Button variant="outline" size="icon" onClick={toggle}>
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </section>

        <Link
          href="/modules"
          className="block rounded-xl bg-white p-4 shadow-sm text-sm font-medium text-wazo-green dark:bg-gray-800"
        >
          {t("modules.title")} →
        </Link>

        {store && (
          <section className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800 space-y-2">
            <p className="text-sm font-medium dark:text-white">{t("settings.storeUrl")}</p>
            <p className="text-xs text-wazo-green break-all">{storefrontUrl}</p>
            <Button variant="outline" size="sm" onClick={copyUrl}>
              {copied ? "✓" : t("settings.copy")}
            </Button>
          </section>
        )}

        <Button variant="destructive" className="w-full" onClick={handleLogout}>
          {t("auth.logout")}
        </Button>
      </main>
    </>
  );
}
