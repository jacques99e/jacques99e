"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import {
  computeAgricultureDecisions,
  dismissAgriDecision,
  type AgriDecision,
} from "@/lib/agriculture-decisions";

export function ParcelDecisionPanel() {
  const [actions, setActions] = useState<AgriDecision[]>([]);
  const [weatherAlert, setWeatherAlert] = useState<string | null>(null);

  const refresh = useCallback((alert?: string | null) => {
    setActions(
      computeAgricultureDecisions({
        weatherAlert: alert ?? weatherAlert,
        limit: 4,
      })
    );
  }, [weatherAlert]);

  useEffect(() => {
    refresh();

    const loadWeather = (lat?: number, lon?: number) => {
      const query =
        typeof lat === "number" && typeof lon === "number"
          ? `/api/agriculture/weather?lat=${lat}&lon=${lon}`
          : "/api/agriculture/weather";
      void apiFetch(query)
        .then(async (res) => {
          const json = (await res.json()) as { alert?: string | null };
          if (res.ok) {
            const alert = json.alert || null;
            setWeatherAlert(alert);
            setActions(
              computeAgricultureDecisions({ weatherAlert: alert, limit: 4 })
            );
          }
        })
        .catch(() => undefined);
    };

    if (!navigator.geolocation) {
      loadWeather();
    } else {
      navigator.geolocation.getCurrentPosition(
        (pos) => loadWeather(pos.coords.latitude, pos.coords.longitude),
        () => loadWeather(),
        { timeout: 10_000, maximumAge: 300_000 }
      );
    }

    const onStorage = (e: StorageEvent) => {
      if (
        !e.key ||
        e.key === "wazo_cultures" ||
        e.key.startsWith("wazo_agri_journal") ||
        e.key.startsWith("wazo_market_prices") ||
        e.key === "wazo_agri_decisions_dismissed"
      ) {
        refresh();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refresh]);

  const onDismiss = (id: string) => {
    dismissAgriDecision(id);
    setActions((prev) => prev.filter((a) => a.id !== id));
  };

  if (!actions.length) return null;

  return (
    <section className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-lime-50 p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-emerald-950">
        <Sprout className="h-4 w-4 shrink-0 text-emerald-700" />
        <h2 className="text-sm font-semibold">Que faire sur mes parcelles ?</h2>
      </div>

      <ul className="space-y-3">
        {actions.map((action, index) => (
          <li
            key={action.id}
            className="rounded-xl border border-emerald-100/80 bg-white/85 p-3"
          >
            <div className="flex gap-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-[10px] font-bold text-white">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900">{action.title}</p>
                <p className="mt-0.5 text-xs text-gray-600">{action.reason}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button asChild size="sm" className="bg-emerald-700 hover:bg-emerald-800">
                    <Link href={action.href}>{action.ctaLabel}</Link>
                  </Button>
                  <button
                    type="button"
                    onClick={() => onDismiss(action.id)}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-gray-500 hover:bg-white hover:text-gray-700"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Fait
                  </button>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-[11px] text-emerald-900/70">
        Conseils basés sur vos cultures, prix marchés et météo (si disponible).
      </p>
    </section>
  );
}
