export interface AgricultureWeather {
  temp_c: number;
  condition: string;
  humidity: number;
  alert: string | null;
  source: string;
  location?: string;
  lat: number;
  lon: number;
}

/** Dakar — repli Afrique de l'Ouest si GPS indisponible. */
export const DEFAULT_WEATHER_LAT = Number(process.env.AGRICULTURE_DEFAULT_LAT) || 14.7167;
export const DEFAULT_WEATHER_LON = Number(process.env.AGRICULTURE_DEFAULT_LON) || -17.4677;

const WMO_FR: Record<number, string> = {
  0: "Ciel dégagé",
  1: "Principalement dégagé",
  2: "Partiellement nuageux",
  3: "Couvert",
  45: "Brouillard",
  48: "Brouillard givrant",
  51: "Bruine légère",
  53: "Bruine",
  55: "Bruine dense",
  56: "Bruine verglaçante",
  57: "Bruine verglaçante dense",
  61: "Pluie faible",
  63: "Pluie modérée",
  65: "Pluie forte",
  66: "Pluie verglaçante",
  67: "Pluie verglaçante forte",
  71: "Neige faible",
  73: "Neige modérée",
  75: "Neige forte",
  77: "Grains de neige",
  80: "Averses légères",
  81: "Averses modérées",
  82: "Averses violentes",
  85: "Averses de neige",
  86: "Fortes averses de neige",
  95: "Orage",
  96: "Orage avec grêle",
  99: "Orage violent avec grêle",
};

function describeWeatherCode(code: number): string {
  return WMO_FR[code] ?? "Conditions variables";
}

function parseCoord(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function resolveWeatherCoordinates(
  latParam: string | null,
  lonParam: string | null
): { lat: number; lon: number; fromGps: boolean } {
  const lat = parseCoord(latParam);
  const lon = parseCoord(lonParam);
  if (lat !== null && lon !== null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
    return { lat, lon, fromGps: true };
  }
  return { lat: DEFAULT_WEATHER_LAT, lon: DEFAULT_WEATHER_LON, fromGps: false };
}

async function reverseGeocode(lat: number, lon: number): Promise<string | undefined> {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/reverse");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("language", "fr");
  url.searchParams.set("count", "1");

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8_000) });
  if (!res.ok) return undefined;

  const data = (await res.json()) as {
    results?: Array<{ name?: string; admin1?: string; country?: string }>;
  };
  const place = data.results?.[0];
  if (!place?.name) return undefined;

  const parts = [place.name, place.admin1, place.country].filter(Boolean);
  return parts.join(", ");
}

async function fetchOpenMeteoWeather(lat: number, lon: number): Promise<AgricultureWeather> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("current", "temperature_2m,relative_humidity_2m,weather_code,precipitation");
  url.searchParams.set("daily", "precipitation_sum,weather_code");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "3");

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(12_000) });
  if (!res.ok) {
    throw new Error(`Open-Meteo indisponible (${res.status})`);
  }

  const data = (await res.json()) as {
    current?: {
      temperature_2m?: number;
      relative_humidity_2m?: number;
      weather_code?: number;
      precipitation?: number;
    };
    daily?: { precipitation_sum?: number[] };
  };

  const current = data.current;
  if (!current || typeof current.temperature_2m !== "number") {
    throw new Error("Réponse météo incomplète");
  }

  const todayRain = data.daily?.precipitation_sum?.[0] ?? 0;
  const tomorrowRain = data.daily?.precipitation_sum?.[1] ?? 0;
  const nowRain = current.precipitation ?? 0;

  let alert: string | null = null;
  if (todayRain >= 20) {
    alert = `Fortes pluies aujourd'hui (~${Math.round(todayRain)} mm). Retardez les traitements.`;
  } else if (tomorrowRain >= 15) {
    alert = `Pluies prévues demain (~${Math.round(tomorrowRain)} mm). Anticipez les récoltes.`;
  } else if (nowRain > 0.5) {
    alert = "Précipitations en cours — évitez les traitements foliaires.";
  } else if (todayRain >= 5) {
    alert = `Pluie légère prévue (~${Math.round(todayRain)} mm).`;
  }

  const location = await reverseGeocode(lat, lon).catch(() => undefined);

  return {
    temp_c: Math.round(current.temperature_2m),
    condition: describeWeatherCode(current.weather_code ?? 0),
    humidity: Math.round(current.relative_humidity_2m ?? 0),
    alert,
    source: "open-meteo",
    location,
    lat,
    lon,
  };
}

async function fetchOpenWeatherMap(
  lat: number,
  lon: number,
  apiKey: string
): Promise<AgricultureWeather> {
  const url = new URL("https://api.openweathermap.org/data/2.5/weather");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("appid", apiKey);
  url.searchParams.set("units", "metric");
  url.searchParams.set("lang", "fr");

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(12_000) });
  if (!res.ok) {
    throw new Error(`OpenWeatherMap indisponible (${res.status})`);
  }

  const data = (await res.json()) as {
    main?: { temp?: number; humidity?: number };
    weather?: Array<{ description?: string }>;
    rain?: { "1h"?: number };
    name?: string;
  };

  const rain1h = data.rain?.["1h"] ?? 0;
  let alert: string | null = null;
  if (rain1h >= 5) {
    alert = `Pluie en cours (~${Math.round(rain1h)} mm/h).`;
  }

  return {
    temp_c: Math.round(data.main?.temp ?? 0),
    condition: data.weather?.[0]?.description ?? "—",
    humidity: Math.round(data.main?.humidity ?? 0),
    alert,
    source: "openweathermap",
    location: data.name,
    lat,
    lon,
  };
}

export async function fetchAgricultureWeather(
  lat: number,
  lon: number,
  options?: { openWeatherApiKey?: string }
): Promise<AgricultureWeather> {
  const openWeatherKey = options?.openWeatherApiKey?.trim();

  if (openWeatherKey) {
    try {
      return await fetchOpenWeatherMap(lat, lon, openWeatherKey);
    } catch {
      /* repli Open-Meteo */
    }
  }

  return fetchOpenMeteoWeather(lat, lon);
}

export function withLocationHint(
  weather: AgricultureWeather,
  fromGps: boolean
): AgricultureWeather {
  if (fromGps || weather.location) return weather;
  return {
    ...weather,
    location: "Afrique de l'Ouest (position par défaut)",
    alert:
      weather.alert ??
      "Activez la localisation pour la météo de votre parcelle.",
  };
}
