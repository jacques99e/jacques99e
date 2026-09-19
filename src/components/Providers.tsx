"use client";

import { ThemeProvider } from "@/contexts/ThemeContext";
import { PWAInstallPrompt } from "./PWAInstallPrompt";
import { PWARegister } from "./PWARegister";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <PWARegister />
      {children}
      <PWAInstallPrompt />
    </ThemeProvider>
  );
}
