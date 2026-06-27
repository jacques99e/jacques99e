"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import type { MarketPrice } from "@/lib/agriculture-markets";
import {
  clearCustomMarketPrices,
  readCustomMarketRegion,
  readMarketPrices,
  writeMarketPrices,
} from "@/lib/agriculture-markets";
import type { MarketRegionId } from "@/lib/agriculture-markets-regions";
import { isMarketRegionId } from "@/lib/agriculture-markets-regions";

const STORAGE_KEY = "wazo_market_prices_custom";
const REGION_PREF_KEY = "wazo_market_region_preference";
const COORDS_KEY = "wazo_market_last_coords";

interface MarketApiResponse {
  success: boolean;
  regionId?: string;
  regionLabel?: string;
  location?: string;
  prices?: MarketPrice[];
  fromGps?: boolean;
  source?: "gps" | "manual" | "default";
  error?: string;
}

function mergeWithCustomOverrides(
  localized: MarketPrice[],
  custom: MarketPrice[] | null
): MarketPrice[] {
  if (!custom?.length) return localized;
  const customById = new Map(custom.map((p) => [p.id, p]));
  return localized.map((p) => customById.get(p.id) ?? p);
}

function readRegionPreference(): MarketRegionId | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(REGION_PREF_KEY);
  return raw && isMarketRegionId(raw) ? raw : null;
}

function writeRegionPreference(regionId: MarketRegionId) {
  localStorage.setItem(REGION_PREF_KEY, regionId);
}

function readCachedCoords(): { lat: number; lon: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(COORDS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { lat?: number; lon?: number };
    if (typeof parsed.lat === "number" && typeof parsed.lon === "number") {
      return { lat: parsed.lat, lon: parsed.lon };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function writeCachedCoords(lat: number, lon: number) {
  sessionStorage.setItem(COORDS_KEY, JSON.stringify({ lat, lon }));
}

const GEO_OPTIONS: PositionOptions = {
  timeout: 20_000,
  maximumAge: 120_000,
  enableHighAccuracy: true,
};

export function useLocalizedMarketPrices() {
  const [prices, setPrices] = useState<MarketPrice[]>([]);
  const [location, setLocation] = useState("");
  const [regionLabel, setRegionLabel] = useState("");
  const [regionId, setRegionId] = useState<MarketRegionId | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fromGps, setFromGps] = useState(false);
  const [source, setSource] = useState<"gps" | "manual" | "default">("default");
  const [regionPreference, setRegionPreference] = useState<MarketRegionId | "">("");

  const load = useCallback(
    (options?: {
      lat?: number;
      lon?: number;
      region?: MarketRegionId;
      /** Pays choisi manuellement : ignorer le GPS et les coordonnées en cache. */
      manualOnly?: boolean;
    }) => {
      const params = new URLSearchParams();
      const manualRegion = options?.region ?? (options?.manualOnly ? readRegionPreference() : null);
      const pref = options?.region ?? readRegionPreference();

      if (manualRegion) {
        params.set("region", manualRegion);
      } else if (typeof options?.lat === "number" && typeof options?.lon === "number") {
        params.set("lat", options.lat.toFixed(5));
        params.set("lon", options.lon.toFixed(5));
      } else {
        const cached = readCachedCoords();
        if (cached) {
          params.set("lat", cached.lat.toFixed(5));
          params.set("lon", cached.lon.toFixed(5));
        }
        if (pref) params.set("region", pref);
      }

      const query = `/api/agriculture/markets?${params.toString()}`;
      setLoading(true);

      void apiFetch(query)
        .then(async (res) => {
          const json = (await res.json()) as MarketApiResponse;
          if (!res.ok || !json.success || !json.prices?.length) {
            throw new Error(json.error || "Prix indisponibles");
          }

          const hasCustom = Boolean(localStorage.getItem(STORAGE_KEY));
          const savedRegion = readCustomMarketRegion();

          if (hasCustom && !savedRegion) {
            clearCustomMarketPrices();
          }

          if (hasCustom && savedRegion && savedRegion !== json.regionId) {
            clearCustomMarketPrices();
          }

          const hasCustomForRegion =
            Boolean(localStorage.getItem(STORAGE_KEY)) &&
            readCustomMarketRegion() === json.regionId;
          const merged =
            hasCustomForRegion
              ? mergeWithCustomOverrides(json.prices, readMarketPrices())
              : json.prices;

          const resolvedRegion =
            json.regionId && isMarketRegionId(json.regionId) ? json.regionId : "";

          setPrices(merged);
          setLocation(json.location ?? json.regionLabel ?? "");
          setRegionLabel(json.regionLabel ?? "");
          setRegionId(resolvedRegion);
          setFromGps(Boolean(json.fromGps));
          setSource(
            json.source ??
              (manualRegion || pref ? "manual" : json.fromGps ? "gps" : "default")
          );
          setRegionPreference(manualRegion ?? pref ?? resolvedRegion);
          setError("");
        })
        .catch((err: unknown) => {
          setPrices(readMarketPrices());
          setError(err instanceof Error ? err.message : "Impossible de charger les prix.");
        })
        .finally(() => setLoading(false));
    },
    []
  );

  const requestGps = useCallback(() => {
    if (!navigator.geolocation) {
      load();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        writeCachedCoords(lat, lon);
        load({ lat, lon });
      },
      () => {
        const cached = readCachedCoords();
        if (cached) {
          load({ lat: cached.lat, lon: cached.lon });
          return;
        }
        load();
        setError(
          "Position GPS indisponible. Choisissez votre pays dans la liste ci-dessous."
        );
      },
      GEO_OPTIONS
    );
  }, [load]);

  useEffect(() => {
    const pref = readRegionPreference();
    if (pref) {
      setRegionPreference(pref);
      load({ region: pref, manualOnly: true });
      return;
    }
    requestGps();
  }, [requestGps, load]);

  const updatePrices = (next: MarketPrice[] | ((prev: MarketPrice[]) => MarketPrice[])) => {
    setPrices((prev) => (typeof next === "function" ? next(prev) : next));
  };

  const savePrices = (next: MarketPrice[]) => {
    setPrices(next);
    if (regionId) writeMarketPrices(next, regionId);
    else writeMarketPrices(next);
  };

  const selectRegion = (nextRegion: MarketRegionId) => {
    writeRegionPreference(nextRegion);
    setRegionPreference(nextRegion);

    const savedRegion = readCustomMarketRegion();
    if (!savedRegion || savedRegion !== nextRegion) {
      clearCustomMarketPrices();
    }

    load({ region: nextRegion, manualOnly: true });
  };

  const refreshFromLocation = () => {
    setError("");
    if (!navigator.geolocation) {
      load();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        writeCachedCoords(lat, lon);
        localStorage.removeItem(REGION_PREF_KEY);
        setRegionPreference("");
        load({ lat, lon });
      },
      () => {
        setError(
          "Impossible de lire le GPS. Choisissez votre pays manuellement."
        );
      },
      { ...GEO_OPTIONS, maximumAge: 0 }
    );
  };

  return {
    prices,
    updatePrices,
    savePrices,
    location,
    regionLabel,
    regionId,
    regionPreference,
    selectRegion,
    loading,
    error,
    fromGps,
    source,
    refreshFromLocation,
  };
}
