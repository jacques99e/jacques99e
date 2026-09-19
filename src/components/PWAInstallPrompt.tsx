"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Download, X } from "lucide-react";
import { Button } from "./ui/button";
import { useI18n } from "@/contexts/I18nContext";
import { isIosSafari, isPublicStorefrontPath, isStandalonePwa } from "@/lib/pwa";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "wazo_pwa_install_dismissed";

export function PWAInstallPrompt() {
  const { t } = useI18n();
  const pathname = usePathname() || "/";
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [manual, setManual] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (isStandalonePwa() || isPublicStorefrontPath(pathname)) {
      setDismissed(true);
      return;
    }
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") {
        setDismissed(true);
        return;
      }
    } catch {
      // ignore
    }
    setDismissed(false);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setManual(false);
    };
    window.addEventListener("beforeinstallprompt", handler);
    const timer = window.setTimeout(() => {
      if (!isStandalonePwa()) setManual(true);
    }, 2500);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.clearTimeout(timer);
    };
  }, [pathname]);

  if (dismissed || isPublicStorefrontPath(pathname)) return null;
  if (!deferred && !manual) return null;

  const hide = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    setDeferred(null);
    hide();
  };

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 mx-auto max-w-lg rounded-xl bg-wazo-green p-4 text-white shadow-lg safe-bottom">
      <button type="button" className="absolute right-2 top-2" onClick={hide} aria-label="Fermer">
        <X className="h-4 w-4" />
      </button>
      <p className="pr-6 text-sm font-medium">{t("pwa.installTitle")}</p>
      <p className="mt-1 text-xs text-white/80">{t("pwa.installDesc")}</p>
      {deferred ? (
        <Button variant="orange" size="sm" className="mt-3 w-full" onClick={() => void install()}>
          <Download className="h-4 w-4" />
          {t("pwa.install")}
        </Button>
      ) : (
        <p className="mt-2 text-xs text-white/90">
          {isIosSafari() ? t("pwa.iosHint") : t("pwa.androidHint")}
        </p>
      )}
    </div>
  );
}
