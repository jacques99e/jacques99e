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
  }, []);

  return (
    <ThemeProvider>
      {children}
      <PWAInstallPrompt />
    </ThemeProvider>
  );
}
