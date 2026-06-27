import {
  COUNTRY_TO_MARKET_REGION,
  getMarketRegion,
  isMarketRegionId,
  type MarketRegion,
  type MarketRegionId,
} from "@/lib/agriculture-markets-regions";
import type { MarketPrice } from "@/lib/agriculture-markets";

export interface ReverseGeocodeResult {
  countryCode?: string;
  countryName?: string;
  location?: string;
}

const NOMINATIM_USER_AGENT =
  "WAZO-Digital/1.0 (agriculture; contact@app.wazo-digital.com)";

/** Bounding boxes — smallest / most specific regions first. */
const COORD_REGION_BOUNDS: Array<{
  id: MarketRegionId;
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}> = [
  { id: "togo", minLat: 6.0, maxLat: 11.2, minLon: -0.2, maxLon: 1.85 },
  { id: "benin", minLat: 6.2, maxLat: 12.5, minLon: 0.75, maxLon: 3.9 },
  { id: "cote_ivoire", minLat: 4.0, maxLat: 10.85, minLon: -8.65, maxLon: -2.45 },
  { id: "ghana", minLat: 4.65, maxLat: 11.25, minLon: -3.35, maxLon: 1.25 },
  { id: "guinea", minLat: 7.2, maxLat: 12.75, minLon: -15.2, maxLon: -7.6 },
  { id: "senegal", minLat: 12.25, maxLat: 16.75, minLon: -17.65, maxLon: -11.25 },
  { id: "burkina", minLat: 9.35, maxLat: 15.15, minLon: -5.55, maxLon: 2.45 },
  { id: "niger", minLat: 11.7, maxLat: 15.0, minLon: -0.2, maxLon: 16.0 },
  { id: "mali", minLat: 10.0, maxLat: 25.0, minLon: -12.3, maxLon: 4.35 },
  { id: "cameroun", minLat: 1.65, maxLat: 13.15, minLon: 8.45, maxLon: 16.25 },
];

const COUNTRY_NAME_TO_REGION: Record<string, MarketRegionId> = {
  senegal: "senegal",
  sénégal: "senegal",
  "cote d'ivoire": "cote_ivoire",
  "côte d'ivoire": "cote_ivoire",
  "ivory coast": "cote_ivoire",
  mali: "mali",
  "burkina faso": "burkina",
  burkina: "burkina",
  ghana: "ghana",
  cameroun: "cameroun",
  cameroon: "cameroun",
  benin: "benin",
  bénin: "benin",
  togo: "togo",
  niger: "niger",
  guinea: "guinea",
  guinée: "guinea",
  gambia: "senegal",
  gambie: "senegal",
  mauritania: "west_africa",
  mauritanie: "west_africa",
  nigeria: "west_africa",
  nigéria: "west_africa",
};

function normalizeCountryName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

function parseCoord(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function parseMarketCoordinates(
  latParam: string | null,
  lonParam: string | null
): { lat: number; lon: number } | null {
  const lat = parseCoord(latParam);
  const lon = parseCoord(lonParam);
  if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return null;
  }
  return { lat, lon };
}

async function nominatimReverse(lat: number, lon: number): Promise<ReverseGeocodeResult> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "fr");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": NOMINATIM_USER_AGENT },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return {};

  const data = (await res.json()) as {
    display_name?: string;
    address?: {
      country?: string;
      country_code?: string;
      city?: string;
      town?: string;
      village?: string;
      state?: string;
      region?: string;
    };
  };

  const address = data.address;
  if (!address) return {};

  const city =
    address.city ?? address.town ?? address.village ?? address.state ?? address.region ?? "";
  const country = address.country ?? "";
  const locationParts = [city, country].filter(Boolean);

  return {
    countryCode: address.country_code?.toUpperCase(),
    countryName: country || undefined,
    location: locationParts.length ? locationParts.join(", ") : data.display_name,
  };
}

export function detectRegionFromCoordinates(lat: number, lon: number): MarketRegionId | null {
  for (const box of COORD_REGION_BOUNDS) {
    if (
      lat >= box.minLat &&
      lat <= box.maxLat &&
      lon >= box.minLon &&
      lon <= box.maxLon
    ) {
      return box.id;
    }
  }
  return null;
}

export function resolveMarketRegionFromCountry(
  countryCode?: string,
  countryName?: string
): MarketRegion | null {
  if (countryCode) {
    const fromCode = COUNTRY_TO_MARKET_REGION[countryCode];
    if (fromCode) return getMarketRegion(fromCode);
  }

  if (countryName) {
    const fromName = COUNTRY_NAME_TO_REGION[normalizeCountryName(countryName)];
    if (fromName) return getMarketRegion(fromName);
  }

  return null;
}

const EMPTY_GEO: ReverseGeocodeResult = {};

async function reverseGeocodePlace(lat: number, lon: number): Promise<ReverseGeocodeResult> {
  return nominatimReverse(lat, lon).catch(() => EMPTY_GEO);
}

function resolveRegion(
  lat?: number,
  lon?: number,
  geo?: ReverseGeocodeResult,
  regionOverride?: MarketRegionId
): MarketRegion {
  if (regionOverride && isMarketRegionId(regionOverride)) {
    return getMarketRegion(regionOverride);
  }

  if (typeof lat === "number" && typeof lon === "number") {
    const fromCoords = detectRegionFromCoordinates(lat, lon);
    if (fromCoords) return getMarketRegion(fromCoords);
  }

  const fromCountry = resolveMarketRegionFromCountry(geo?.countryCode, geo?.countryName);
  if (fromCountry) return fromCountry;

  return getMarketRegion("west_africa");
}

export interface LocalizedMarketPrices {
  regionId: MarketRegionId;
  regionLabel: string;
  location?: string;
  prices: MarketPrice[];
  fromGps: boolean;
  source: "gps" | "manual" | "default";
  countryCode?: string;
}

export async function fetchLocalizedMarketPrices(options: {
  lat?: number;
  lon?: number;
  fromGps?: boolean;
  regionOverride?: MarketRegionId;
}): Promise<LocalizedMarketPrices> {
  const { lat, lon, fromGps = false, regionOverride } = options;

  if (regionOverride && isMarketRegionId(regionOverride)) {
    const region = getMarketRegion(regionOverride);
    return {
      regionId: region.id,
      regionLabel: region.label,
      location: region.label,
      prices: region.prices,
      fromGps: false,
      source: "manual",
    };
  }

  const hasCoords =
    typeof lat === "number" &&
    typeof lon === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lon);

  if (!hasCoords) {
    const region = getMarketRegion("west_africa");
    return {
      regionId: region.id,
      regionLabel: region.label,
      location: "Sélectionnez votre pays ci-dessous",
      prices: region.prices,
      fromGps: false,
      source: "default",
    };
  }

  const geo = await reverseGeocodePlace(lat, lon);
  const region = resolveRegion(lat, lon, geo, regionOverride);

  return {
    regionId: region.id,
    regionLabel: region.label,
    location: geo.location ?? region.label,
    prices: region.prices,
    fromGps,
    source: "gps",
    countryCode: geo.countryCode,
  };
}
