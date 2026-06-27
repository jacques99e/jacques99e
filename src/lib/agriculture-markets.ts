export interface MarketPrice {
  id: string;
  product: string;
  unit: string;
  priceFcfa: number;
  market: string;
  trend: "up" | "down" | "stable";
  updatedAt: string;
}

import { getMarketRegion } from "@/lib/agriculture-markets-regions";

const STORAGE_KEY = "wazo_market_prices_custom";
const STORAGE_REGION_KEY = "wazo_market_prices_region";

const DEFAULT_MARKET_PRICES = getMarketRegion("west_africa").prices;

export function readMarketPrices(): MarketPrice[] {
  if (typeof window === "undefined") return DEFAULT_MARKET_PRICES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_MARKET_PRICES;
    const parsed = JSON.parse(raw) as MarketPrice[];
    return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_MARKET_PRICES;
  } catch {
    return DEFAULT_MARKET_PRICES;
  }
}

export function readCustomMarketRegion(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_REGION_KEY);
}

export function writeMarketPrices(prices: MarketPrice[], regionId?: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prices));
  if (regionId) localStorage.setItem(STORAGE_REGION_KEY, regionId);
}

export function clearCustomMarketPrices() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(STORAGE_REGION_KEY);
}

export function estimateHarvestRevenue(kg: number, pricePerKg: number): number {
  return Math.round(kg * pricePerKg);
}

/** @deprecated use readMarketPrices */
export const MARKET_PRICES_CI = getMarketRegion("cote_ivoire").prices;
export const DEFAULT_MARKET_PRICES_CI = MARKET_PRICES_CI;
