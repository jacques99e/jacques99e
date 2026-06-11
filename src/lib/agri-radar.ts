import { readMarketPrices } from "@/lib/agriculture-markets";

export interface RadarAlert {
  id: string;
  level: "info" | "watch" | "critical";
  crop: string;
  title: string;
  message: string;
  action: string;
}

export interface PriceSignal {
  crop: string;
  current: number;
  trend: "up" | "down" | "stable";
  changePercent: number;
}

const DISEASE_ALERTS: RadarAlert[] = [
  {
    id: "cacao-swollen",
    level: "watch",
    crop: "Cacao",
    title: "Surveillance cabosse",
    message: "Humidité élevée en zone forestière — inspectez les cabosses cette semaine.",
    action: "Traiter les foyers et noter dans le calendrier cultural",
  },
  {
    id: "mais-armyworm",
    level: "critical",
    crop: "Maïs",
    title: "Risque chenille légionnaire",
    message: "Saison des pluies : surveillance accrue sur plants de 2-6 semaines.",
    action: "Passage quotidien matin/soir sur 10 plants témoins",
  },
  {
    id: "riz-birds",
    level: "info",
    crop: "Riz",
    title: "Protection récolte",
    message: "Période de maturation — prévoir filets ou patrouilles communautaires.",
    action: "Coordonner avec la coopérative voisine",
  },
];

const SOWING_WINDOWS: Record<string, string> = {
  Maïs: "Fenêtre optimale : début saison des pluies (mars-avril zone sud)",
  Cacao: "Plantation jeunes plants : saison humide modérée",
  Riz: "Repiquage : quand les pluies sont établies 2 semaines",
  Anacarde: "Taille post-récolte recommandée maintenant",
};

export function getDiseaseAlerts(cropFilter?: string): RadarAlert[] {
  if (!cropFilter || cropFilter === "all") return DISEASE_ALERTS;
  return DISEASE_ALERTS.filter((a) => a.crop === cropFilter);
}

export function getSowingWindow(crop: string): string {
  return SOWING_WINDOWS[crop] ?? "Consultez votre calendrier cultural pour planifier.";
}

export function computePriceSignals(): PriceSignal[] {
  const prices = readMarketPrices();
  return prices.slice(0, 6).map((row) => {
    const change =
      row.trend === "up" ? 6 + (row.priceFcfa % 5) : row.trend === "down" ? -5 : 0;
    return {
      crop: row.product,
      current: row.priceFcfa,
      trend: row.trend,
      changePercent: change,
    };
  });
}
