"use client";

import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { useActiveStore } from "@/hooks/useActiveStore";
import { useBilling } from "@/hooks/useBilling";
import { useModule } from "@/hooks/useModule";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { useI18n } from "@/contexts/I18nContext";
import { useTheme } from "@/contexts/ThemeContext";
import { localStore } from "@/lib/db";
import type { Language } from "@/types";
import Link from "next/link";
import { BILLING_MANAGE_HREF } from "@/lib/billing-checkout";
import { useRouter } from "next/navigation";
import { ExternalLink, Moon, Sun } from "lucide-react";

export default function ProfilePage() {
  const { t, lang, setLang, languages } = useI18n();
  const { user, signOut } = useAuth();
  const { activeStore } = useActiveStore();
  const { canUseAnalytics, canUseTeam } = useBilling();
  const { role, canManageModules, canViewAnalytics, canManageSettings, canManageTeam } =
    useRole(user?.id, activeStore?.membership_role);
  const { dark, toggle } = useTheme();
  const router = useRouter();
  const store = localStore.get();
  const { modules } = useModule(store?.id);
  const hasCommerce = modules.includes("commerce");
  const [copied, setCopied] = useState(false);

  const storefrontUrl =
    typeof window !== "undefined" && store
      ? `${window.location.origin}/boutique/${store.slug}`
      : "";

  const copyUrl = () => {
    if (!storefrontUrl) return;
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
      <main className="app-page pb-6">
        <section className="app-card p-4 dark:bg-gray-800">
          <p className="text-xs text-gray-500">{t("profile.connected")}</p>
          <p className="text-sm font-semibold dark:text-white">{user?.phone ?? "Utilisateur"}</p>
        </section>

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

        <section className="app-card p-4 dark:bg-gray-800">
          <p className="text-xs text-gray-500">{t("profile.role")}</p>
          <p className="text-sm font-semibold dark:text-white">{role ?? "owner"}</p>
        </section>

        {canManageModules ? (
          <Link
            href="/modules"
            className="block rounded-xl bg-white p-4 shadow-sm text-sm font-medium text-wazo-green dark:bg-gray-800"
          >
            {t("modules.title")} →
          </Link>
        ) : null}

        {canViewAnalytics && canUseAnalytics ? (
          <>
            <Link
              href="/insights"
              className="block rounded-xl bg-white p-4 shadow-sm text-sm font-medium text-wazo-green dark:bg-gray-800"
            >
              {t("profile.insightsPro")} →
            </Link>
            <Link
              href="/analytics"
              className="block rounded-xl bg-white p-4 shadow-sm text-sm font-medium text-wazo-green dark:bg-gray-800"
            >
              {t("profile.analytics")} →
            </Link>
          </>
        ) : null}

        {canManageSettings ? (
          <>
            <Link
              href="/settings/business"
              className="block rounded-xl bg-white p-4 shadow-sm text-sm font-medium text-wazo-green dark:bg-gray-800"
            >
              {t("profile.businessSettings")} →
            </Link>
            <Link
              href="/settings/notifications"
              className="block rounded-xl bg-white p-4 shadow-sm text-sm font-medium text-wazo-green dark:bg-gray-800"
            >
              {t("profile.notifications")} →
            </Link>
          </>
        ) : null}

        {canManageTeam && canUseTeam ? (
          <Link
            href="/settings/team"
            className="block rounded-xl bg-white p-4 shadow-sm text-sm font-medium text-wazo-green dark:bg-gray-800"
          >
            {t("profile.team")} →
          </Link>
        ) : null}

        {hasCommerce ? (
          <Link
            href="/clients"
            className="block rounded-xl bg-white p-4 shadow-sm text-sm font-medium text-wazo-green dark:bg-gray-800"
          >
            {t("profile.crm")} →
          </Link>
        ) : null}

        <Link
          href="/settings/stores/new"
          className="block rounded-xl bg-white p-4 shadow-sm text-sm font-medium text-wazo-green dark:bg-gray-800"
        >
          Nouvelle boutique →
        </Link>

        <Link
          href="/achievements"
          className="block rounded-xl bg-white p-4 shadow-sm text-sm font-medium text-wazo-green dark:bg-gray-800"
        >
          Badges & progression →
        </Link>

        <Link
          href="/help"
          className="block rounded-xl bg-white p-4 shadow-sm text-sm font-medium text-wazo-green dark:bg-gray-800"
        >
          {t("profile.helpCenter")} →
        </Link>

        <Link
          href={BILLING_MANAGE_HREF}
          className="block rounded-xl bg-white p-4 shadow-sm text-sm font-medium text-wazo-green dark:bg-gray-800"
        >
          {t("profile.billing")} →
        </Link>

        {store && hasCommerce && (
          <section className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800 space-y-2">
            <p className="text-sm font-medium dark:text-white">{t("settings.storeUrl")}</p>
            <p className="text-xs text-wazo-green break-all">{storefrontUrl}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={copyUrl}>
                {copied ? "✓" : t("settings.copy")}
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href={storefrontUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  {t("profile.open")}
                </a>
              </Button>
            </div>
          </section>
        )}

        <Button variant="destructive" className="w-full" onClick={handleLogout}>
          {t("auth.logout")}
        </Button>
      </main>
    </>
  );
}
