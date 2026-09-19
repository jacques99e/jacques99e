"use client";

import { useEffect } from "react";

/** Enregistre le SW après le nettoyage one-shot des anciens caches HTML. */
export function PWARegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const timer = window.setTimeout(() => {
      void navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
    }, 900);
    return () => window.clearTimeout(timer);
  }, []);

  return null;
}
