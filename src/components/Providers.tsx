"use client";

import { ThemeProvider } from "@/contexts/ThemeContext";
import { PWAInstallPrompt } from "./PWAInstallPrompt";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      {children}
      <PWAInstallPrompt />
    </ThemeProvider>
  );
}
