"use client";

import { useEffect } from "react";
import { useSync } from "@/hooks/useSync";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { registerServiceWorker } from "@/lib/push-client";
import { PWAInstallPrompt } from "./PWAInstallPrompt";

export function Providers({ children }: { children: React.ReactNode }) {
  useSync();

  useEffect(() => {
    const boot = () => {
      void registerServiceWorker();
      if ("caches" in window) {
        void caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))));
      }
    };
    if (document.readyState === "complete") boot();
    else window.addEventListener("load", boot, { once: true });
    return () => window.removeEventListener("load", boot);
  }, []);

  return (
    <ThemeProvider>
      {children}
      <PWAInstallPrompt />
    </ThemeProvider>
  );
}
