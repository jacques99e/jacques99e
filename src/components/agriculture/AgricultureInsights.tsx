"use client";

import { useEffect, useState } from "react";
import { CloudSun, Lightbulb, Sprout } from "lucide-react";
import { listParcels } from "@/lib/agriculture";
import { localStore } from "@/lib/db";

interface WeatherData {
  temp_c: number;
  condition: string;
  humidity: number;
  alert: string | null;
}

export function AgricultureInsights() {
  const storeId = localStore.get()?.id;
  const [parcels, setParcels] = useState(0);
  const [cultures, setCultures] = useState(0);
  const [weather, setWeather] = useState<WeatherData | null>(null);
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
    void fetch("/api/agriculture/tips?crop=general")
      .then((res) => res.json())
      .then((json: { tips?: string[] }) => {
        const tips = json.tips ?? [];
        if (tips.length) setTip(tips[Math.floor(Math.random() * tips.length)]);
      })
      .catch(() => undefined);

    if (!navigator.geolocation) {
      void fetch("/api/agriculture/weather")
        .then((res) => res.json())
        .then((json: WeatherData) => setWeather(json));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void fetch(
          `/api/agriculture/weather?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`
        )
          .then((res) => res.json())
          .then((json: WeatherData) => setWeather(json));
      },
      () => {
        void fetch("/api/agriculture/weather")
          .then((res) => res.json())
          .then((json: WeatherData) => setWeather(json));
      },
      { timeout: 8000 }
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
            <p className="text-lg font-bold text-sky-700">{weather.temp_c}°C</p>
            <p className="text-xs text-gray-600 capitalize">{weather.condition}</p>
            <p className="text-xs text-gray-500">Humidité {weather.humidity}%</p>
            {weather.alert ? <p className="mt-1 text-[10px] text-amber-700">{weather.alert}</p> : null}
          </div>
        </div>
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
