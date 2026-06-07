export interface MarketPrice {
  id: string;
  product: string;
  unit: string;
  priceFcfa: number;
  market: string;
  trend: "up" | "down" | "stable";
  updatedAt: string;
}

const STORAGE_KEY = "wazo_market_prices_custom";

export const DEFAULT_MARKET_PRICES_CI: MarketPrice[] = [
  { id: "cacao", product: "Cacao", unit: "kg", priceFcfa: 1450, market: "San Pedro", trend: "up", updatedAt: "2026-06-01" },
  { id: "cafe", product: "Café arabica", unit: "kg", priceFcfa: 2200, market: "Daloa", trend: "stable", updatedAt: "2026-06-01" },
  { id: "mais", product: "Maïs", unit: "kg", priceFcfa: 280, market: "Bouaké", trend: "down", updatedAt: "2026-06-01" },
  { id: "riz", product: "Riz paddy", unit: "kg", priceFcfa: 350, market: "Gagnoa", trend: "stable", updatedAt: "2026-06-01" },
  { id: "anacarde", product: "Noix de cajou", unit: "kg", priceFcfa: 650, market: "Korhogo", trend: "up", updatedAt: "2026-06-01" },
  { id: "manioc", product: "Manioc", unit: "kg", priceFcfa: 120, market: "Abidjan", trend: "stable", updatedAt: "2026-06-01" },
];

export function readMarketPrices(): MarketPrice[] {
  if (typeof window === "undefined") return DEFAULT_MARKET_PRICES_CI;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_MARKET_PRICES_CI;
    const parsed = JSON.parse(raw) as MarketPrice[];
    return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_MARKET_PRICES_CI;
  } catch {
    return DEFAULT_MARKET_PRICES_CI;
  }
}

export function writeMarketPrices(prices: MarketPrice[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prices));
}

export function estimateHarvestRevenue(kg: number, pricePerKg: number): number {
  return Math.round(kg * pricePerKg);
}

/** @deprecated use readMarketPrices */
export const MARKET_PRICES_CI = DEFAULT_MARKET_PRICES_CI;
