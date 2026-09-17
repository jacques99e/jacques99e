"use client";

import { useEffect } from "react";
import { useSync } from "@/hooks/useSync";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { registerServiceWorker } from "@/lib/push-client";
import { PWAInstallPrompt } from "./PWAInstallPrompt";

export function Providers({ children }: { children: React.ReactNode }) {
  useSync();

  useEffect(() => {
    void registerServiceWorker();
    if ("caches" in window) {
      void caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("wazo-app-") && key !== "wazo-app-v5")
            .map((key) => caches.delete(key))
        )
      );
    }
  }, []);

  return (
    <ThemeProvider>
      {children}
      <PWAInstallPrompt />
    </ThemeProvider>
  );
}
