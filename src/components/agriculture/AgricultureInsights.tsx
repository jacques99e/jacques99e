"use client";

import { useEffect, useState } from "react";
import { CloudSun, Lightbulb, MapPin, Sprout } from "lucide-react";
import { listParcels } from "@/lib/agriculture";
import { apiFetch } from "@/lib/api-client";
import { localStore } from "@/lib/db";

interface WeatherData {
  temp_c: number;
  condition: string;
  humidity: number;
  alert: string | null;
  location?: string;
  source?: string;
  error?: string;
}

export function AgricultureInsights() {
  const storeId = localStore.get()?.id;
  const [parcels, setParcels] = useState(0);
  const [cultures, setCultures] = useState(0);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherError, setWeatherError] = useState("");
  const [tip, setTip] = useState<string>("");

  useEffect(() => {
    if (!storeId) return;
    void listParcels(storeId).then((rows) => setParcels(rows.length));
    try {
      const raw = localStorage.getItem("wazo_cultures");
      if (raw) setCultures((JSON.parse(raw) as unknown[]).length);
    } catch {
      /* ignore */
    }
  }, [storeId]);

  useEffect(() => {
    void apiFetch("/api/agriculture/tips?crop=general")
      .then((res) => res.json())
      .then((json: { tips?: string[] }) => {
        const tips = json.tips ?? [];
        if (tips.length) setTip(tips[Math.floor(Math.random() * tips.length)]);
      })
      .catch(() => undefined);

    const loadWeather = (lat?: number, lon?: number) => {
      const query =
        typeof lat === "number" && typeof lon === "number"
          ? `/api/agriculture/weather?lat=${lat}&lon=${lon}`
          : "/api/agriculture/weather";

      void apiFetch(query)
        .then(async (res) => {
          const json = (await res.json()) as WeatherData & { success?: boolean; error?: string };
          if (!res.ok || json.success === false) {
            throw new Error(json.error || "Météo indisponible");
          }
          setWeatherError("");
          setWeather(json);
        })
        .catch((err: unknown) => {
          setWeather(null);
          setWeatherError(
            err instanceof Error ? err.message : "Impossible de charger la météo."
          );
        });
    };

    if (!navigator.geolocation) {
      loadWeather();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => loadWeather(pos.coords.latitude, pos.coords.longitude),
      () => loadWeather(),
      { timeout: 10_000, maximumAge: 300_000 }
    );
  }, []);

  return (
    <section className="space-y-3">
      <div className="grid grid-cols-2 gap-2 text-center text-xs">
        <div className="app-card p-3">
          <p className="text-xl font-bold text-emerald-700">{parcels}</p>
          <p className="text-gray-500">Parcelles</p>
        </div>
        <div className="app-card p-3">
          <p className="text-xl font-bold text-emerald-700">{cultures}</p>
          <p className="text-gray-500">Cultures suivies</p>
        </div>
      </div>

      {weather ? (
        <div className="app-card flex items-start gap-3 p-4">
          <div className="rounded-xl bg-sky-100 p-2.5 text-sky-700">
            <CloudSun className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">Météo locale</p>
            {weather.location ? (
              <p className="mt-0.5 flex items-center gap-1 text-[10px] text-gray-500">
                <MapPin className="h-3 w-3" />
                {weather.location}
              </p>
            ) : null}
            <p className="text-lg font-bold text-sky-700">{weather.temp_c}°C</p>
            <p className="text-xs text-gray-600 capitalize">{weather.condition}</p>
            <p className="text-xs text-gray-500">Humidité {weather.humidity}%</p>
            {weather.alert ? <p className="mt-1 text-[10px] text-amber-700">{weather.alert}</p> : null}
          </div>
        </div>
      ) : null}

      {weatherError ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{weatherError}</p>
      ) : null}

      {tip ? (
        <div className="app-card flex items-start gap-3 p-4">
          <div className="rounded-xl bg-amber-100 p-2.5 text-amber-700">
            <Lightbulb className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">Conseil du jour</p>
            <p className="mt-1 text-xs text-gray-600">{tip}</p>
          </div>
        </div>
      ) : null}

      {parcels === 0 && cultures === 0 ? (
        <div className="app-card flex items-center gap-3 p-4 text-xs text-gray-600">
          <Sprout className="h-5 w-5 shrink-0 text-emerald-700" />
          Commencez par enregistrer une parcelle ou une culture pour suivre votre récolte.
        </div>
      ) : null}
    </section>
  );
}
