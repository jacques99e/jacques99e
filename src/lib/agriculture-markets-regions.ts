import type { MarketPrice } from "@/lib/agriculture-markets";

export type MarketRegionId =
  | "senegal"
  | "cote_ivoire"
  | "mali"
  | "burkina"
  | "ghana"
  | "cameroun"
  | "benin"
  | "togo"
  | "niger"
  | "guinea"
  | "west_africa";

export interface MarketRegion {
  id: MarketRegionId;
  label: string;
  prices: MarketPrice[];
}

export const MARKET_REGION_OPTIONS: { id: MarketRegionId; label: string }[] = [
  { id: "senegal", label: "Sénégal" },
  { id: "cote_ivoire", label: "Côte d'Ivoire" },
  { id: "mali", label: "Mali" },
  { id: "burkina", label: "Burkina Faso" },
  { id: "ghana", label: "Ghana" },
  { id: "cameroun", label: "Cameroun" },
  { id: "benin", label: "Bénin" },
  { id: "togo", label: "Togo" },
  { id: "niger", label: "Niger" },
  { id: "guinea", label: "Guinée" },
  { id: "west_africa", label: "Autre (Afrique de l'Ouest)" },
];

const today = () => new Date().toISOString().slice(0, 10);

function basePrices(
  market: string,
  overrides: Partial<Record<MarketPrice["id"], number>>
): MarketPrice[] {
  const defaults: Record<
    MarketPrice["id"],
    { product: string; unit: string; price: number; trend: MarketPrice["trend"] }
  > = {
    cacao: { product: "Cacao", unit: "kg", price: 1450, trend: "up" },
    cafe: { product: "Café arabica", unit: "kg", price: 2200, trend: "stable" },
    mais: { product: "Maïs", unit: "kg", price: 280, trend: "down" },
    riz: { product: "Riz paddy", unit: "kg", price: 350, trend: "stable" },
    anacarde: { product: "Noix de cajou", unit: "kg", price: 650, trend: "up" },
    manioc: { product: "Manioc", unit: "kg", price: 120, trend: "stable" },
  };

  const updated = today();
  return (Object.keys(defaults) as MarketPrice["id"][]).map((id) => {
    const row = defaults[id];
    return {
      id,
      product: row.product,
      unit: row.unit,
      priceFcfa: overrides[id] ?? row.price,
      market,
      trend: row.trend,
      updatedAt: updated,
    };
  });
}

export const MARKET_REGIONS: Record<MarketRegionId, MarketRegion> = {
  senegal: {
    id: "senegal",
    label: "Sénégal",
    prices: basePrices("Marché Dakar", { riz: 420, mais: 310, manioc: 150 }).map((p) =>
      p.id === "anacarde"
        ? { ...p, product: "Arachide", priceFcfa: 480, trend: "stable" as const }
        : p
    ),
  },
  cote_ivoire: {
    id: "cote_ivoire",
    label: "Côte d'Ivoire",
    prices: basePrices("San Pedro", {
      cacao: 1450,
      cafe: 2200,
      mais: 280,
      riz: 350,
      anacarde: 650,
      manioc: 120,
    }),
  },
  mali: {
    id: "mali",
    label: "Mali",
    prices: basePrices("Bamako", { riz: 380, mais: 260, manioc: 100, anacarde: 580 }),
  },
  burkina: {
    id: "burkina",
    label: "Burkina Faso",
    prices: basePrices("Ouagadougou", { riz: 360, mais: 250, manioc: 110, anacarde: 620 }),
  },
  ghana: {
    id: "ghana",
    label: "Ghana",
    prices: basePrices("Accra", { cacao: 1380, mais: 320, riz: 400, manioc: 140 }),
  },
  cameroun: {
    id: "cameroun",
    label: "Cameroun",
    prices: basePrices("Douala", { cacao: 1420, cafe: 2100, riz: 390, mais: 300, manioc: 130 }),
  },
  benin: {
    id: "benin",
    label: "Bénin",
    prices: basePrices("Cotonou", { riz: 400, mais: 295, manioc: 135, anacarde: 640 }),
  },
  togo: {
    id: "togo",
    label: "Togo",
    prices: basePrices("Lomé", { riz: 385, mais: 285, manioc: 128, anacarde: 635 }),
  },
  niger: {
    id: "niger",
    label: "Niger",
    prices: basePrices("Niamey", { riz: 370, mais: 270, manioc: 115, anacarde: 600 }),
  },
  guinea: {
    id: "guinea",
    label: "Guinée",
    prices: basePrices("Conakry", { riz: 410, mais: 300, manioc: 145, anacarde: 620 }),
  },
  west_africa: {
    id: "west_africa",
    label: "Afrique de l'Ouest",
    prices: basePrices("Marché régional", {
      cacao: 1400,
      cafe: 2150,
      mais: 290,
      riz: 370,
      anacarde: 630,
      manioc: 125,
    }),
  },
};

/** Map ISO 3166-1 alpha-2 country codes to market regions. */
export const COUNTRY_TO_MARKET_REGION: Record<string, MarketRegionId> = {
  SN: "senegal",
  CI: "cote_ivoire",
  ML: "mali",
  BF: "burkina",
  GH: "ghana",
  CM: "cameroun",
  BJ: "benin",
  TG: "togo",
  NE: "niger",
  GN: "guinea",
  MR: "west_africa",
  GM: "senegal",
  GW: "guinea",
  LR: "west_africa",
  SL: "west_africa",
  NG: "west_africa",
};

export function isMarketRegionId(value: string): value is MarketRegionId {
  return value in MARKET_REGIONS;
}

export function getMarketRegion(id: MarketRegionId): MarketRegion {
  return MARKET_REGIONS[id] ?? MARKET_REGIONS.west_africa;
}
