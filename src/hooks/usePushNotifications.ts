"use client";

import { useCallback, useEffect, useState } from "react";
import { getVapidPublicKey, subscribeToPush } from "@/lib/push-client";

const PUSH_ENABLED_KEY = "wazo_push_enabled";

export function usePushNotifications(storeId?: string | null) {
  const [enabled, setEnabled] = useState(false);
  const [supported, setSupported] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSupported(
      Boolean(
        typeof window !== "undefined" &&
          "Notification" in window &&
          "serviceWorker" in navigator &&
          getVapidPublicKey()
      )
    );
    setEnabled(localStorage.getItem(PUSH_ENABLED_KEY) === "1");
  }, []);

  const enable = useCallback(async () => {
    if (!storeId) return false;
    setLoading(true);
    try {
      const ok = await subscribeToPush(storeId);
      if (ok) {
        localStorage.setItem(PUSH_ENABLED_KEY, "1");
        setEnabled(true);
      }
      return ok;
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  const disable = useCallback(() => {
    localStorage.removeItem(PUSH_ENABLED_KEY);
    setEnabled(false);
  }, []);

  return { supported, enabled, loading, enable, disable };
}
