"use client";

import { useSync } from "@/hooks/useSync";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { PWAInstallPrompt } from "./PWAInstallPrompt";

export function Providers({ children }: { children: React.ReactNode }) {
  useSync();
  return (
    <ThemeProvider>
      {children}
      <PWAInstallPrompt />
    </ThemeProvider>
  );
}
