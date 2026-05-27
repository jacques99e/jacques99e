"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "./ui/button";
import { useI18n } from "@/contexts/I18nContext";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstallPrompt() {
  const { t } = useI18n();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!deferred || dismissed) return null;

  const install = async () => {
    await deferred.prompt();
    setDeferred(null);
  };

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 mx-auto max-w-lg rounded-xl bg-wazo-green p-4 text-white shadow-lg safe-bottom">
      <button
        type="button"
        className="absolute right-2 top-2"
        onClick={() => setDismissed(true)}
        aria-label="Close"
      >
        <X className="h-4 w-4" />
      </button>
      <p className="pr-6 text-sm font-medium">{t("pwa.installTitle")}</p>
      <p className="mt-1 text-xs text-white/80">{t("pwa.installDesc")}</p>
      <Button variant="orange" size="sm" className="mt-3 w-full" onClick={install}>
        <Download className="h-4 w-4" />
        {t("pwa.install")}
      </Button>
    </div>
  );
}
